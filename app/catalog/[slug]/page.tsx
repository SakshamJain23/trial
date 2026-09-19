'use client';

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import Script from 'next/script';

const supabaseUrl = 'https://hbvysrcyyxoemorrlyqt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhidnlzcmN5eXhvZW1vcnJseXF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzY5ODgsImV4cCI6MjEwNDUxMjk4OH0.CXOyZ65nqxWbCudFF2hvQlduiXDWjSJ0iWm1RrHIRZs';
const supabase = createClient(supabaseUrl, supabaseKey);

type CartItem = { sku: string; quantity: number; price: number; title: string };

export default function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const [catalog, setCatalog] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProduct, setActiveProduct] = useState<any>(null);
  
  // Cart & Checkout State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
 
  const [filters, setFilters] = useState({
    category: [] as string[],
    style: [] as string[],
    collection: [] as string[],
    minPrice: '',
    maxPrice: '',
    minWeight: '',
    maxWeight: ''
  });
 
  const [currency, setCurrency] = useState('USD');
  const rates: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.5, CNY: 7.24 };
  const getPrice = (usd: number) => (usd * rates[currency]).toFixed(2);

  useEffect(() => {
    async function loadData() {
      const resolvedParams = await params;
     
      const { data: catalogData, error: catalogError } = await supabase
        .from('catalogs')
        .select('*')
        .eq('slug', resolvedParams.slug)
        .maybeSingle();

      if (catalogError || !catalogData) {
        setLoading(false);
        return;
      }

      setCatalog(catalogData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('catalog_items')
        .select('variant_sku')
        .eq('catalog_id', catalogData.id);

      if (itemsError || !itemsData || itemsData.length === 0) {
        setLoading(false);
        return;
      }

      const skus = itemsData.map((item: any) => item.variant_sku);

      const { data: variantsData, error: variantsError } = await supabase
        .from('product_variants')
        .select(`
          sku, price_usd, number_of_stones, grams, color_swatch, shape, stone_cut, plating,
          products (id, title, product_category, type, description, collection),
          product_images (image_src)
        `)
        .in('sku', skus);

      if (!variantsError && variantsData) {
        const formattedProducts = variantsData.map((v: any) => ({
          id: v.sku, sku: v.sku, price_usd: v.price_usd, stones: v.number_of_stones,
          weight: v.grams || '0', color: v.color_swatch, shape: v.shape, cut: v.stone_cut, plating: v.plating,
          title: v.products?.title || 'Unknown', description: v.products?.description || 'No description provided.',
          category: v.products?.product_category || 'Uncategorized', style: v.products?.type || '',
          collection: v.products?.collection || '', image_url: v.product_images?.[0]?.image_src || ''
        }));
       
        setProducts(formattedProducts);
      } else if (variantsError) {
        console.error("Supabase Query Error:", variantsError);
      }

      setLoading(false);
    }
    loadData();
  }, [params]);

  if (loading) return <div className="p-16 text-center text-neutral-500 uppercase tracking-widest text-sm">Loading collection...</div>;
  if (!catalog) return <div className="p-16 text-center text-red-500 font-semibold uppercase tracking-widest text-sm">Catalog not found.</div>;

  const filterOptions = {
    category: Array.from(new Set(products.map(p => p?.category).filter(Boolean))),
    style: Array.from(new Set(products.map(p => p?.style).filter(Boolean))),
    collection: Array.from(new Set(products.map(p => p?.collection).filter(Boolean)))
  };

  const toggleFilter = (type: keyof typeof filters, value: string) => {
    setFilters(prev => {
      const current = prev[type] as string[];
      const updated = current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value];
      return { ...prev, [type]: updated };
    });
  };

  const handleNumberFilterChange = (type: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [type]: value }));
  };

  const filteredProducts = products.filter(p => {
    const matchCategory = filters.category.length === 0 || filters.category.includes(p?.category);
    const matchStyle = filters.style.length === 0 || filters.style.includes(p?.style);
    const matchCollection = filters.collection.length === 0 || filters.collection.includes(p?.collection);
   
    const itemPrice = Number(getPrice(p?.price_usd));
    const matchMinPrice = filters.minPrice === '' || itemPrice >= Number(filters.minPrice);
    const matchMaxPrice = filters.maxPrice === '' || itemPrice <= Number(filters.maxPrice);
   
    const itemWeight = Number(p?.weight);
    const matchMinWeight = filters.minWeight === '' || itemWeight >= Number(filters.minWeight);
    const matchMaxWeight = filters.maxWeight === '' || itemWeight <= Number(filters.maxWeight);
   
    return matchCategory && matchStyle && matchCollection && matchMinPrice && matchMaxPrice && matchMinWeight && matchMaxWeight;
  });

  // Cart Functions
  const toggleCartItem = (product: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCart(prev => {
      const exists = prev.find(item => item.sku === product.sku);
      if (exists) return prev.filter(item => item.sku !== product.sku);
      return [...prev, { sku: product.sku, quantity: 1, price: product.price_usd, title: product.title }];
    });
  };

  const updateQuantity = (sku: string, delta: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCart(prev => prev.map(item => {
      if (item.sku === sku) return { ...item, quantity: Math.max(1, item.quantity + delta) };
      return item;
    }));
  };

  const totalUsdPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Checkout Handlers
  const handlePaymentLinkRequest = async () => {
    if (cart.length === 0) return;
    if (!customerEmail || !customerPhone) {
      alert("Please provide both email and phone number to request a payment link.");
      return;
    }
    
    setIsCheckingOut(true);
    try {
      const { data: cartData, error: cartError } = await supabase
        .from('carts')
        .insert([{ 
          status: 'payment_link_requested', 
          checkout_method: 'Payment Link',
          customer_email: customerEmail,
          customer_phone: customerPhone
        }]).select().single();

      if (cartError || !cartData) throw new Error("Failed to generate cart ID");

      const itemsToInsert = cart.map(item => ({ cart_id: cartData.id, sku: item.sku, quantity: item.quantity, price: item.price }));
      await supabase.from('cart_items').insert(itemsToInsert);

      alert("Request received! We will send a secure payment link to your provided contact details shortly.");
      setCart([]);
      setIsCartOpen(false);
      setCustomerEmail('');
      setCustomerPhone('');
    } catch (error) {
      alert("Checkout failed. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleWhatsAppInquiry = async () => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);
    try {
      const { data: cartData, error: cartError } = await supabase
        .from('carts')
        .insert([{ 
          status: 'whatsapp_shared', 
          checkout_method: 'WhatsApp',
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null
        }]).select().single();

      if (cartError || !cartData) throw new Error("Failed to generate cart ID");

      const itemsToInsert = cart.map(item => ({ cart_id: cartData.id, sku: item.sku, quantity: item.quantity, price: item.price }));
      await supabase.from('cart_items').insert(itemsToInsert);

      const whatsappNumber = "919829033766";
      const itemSummary = cart.map(item => `${item.quantity}x ${item.sku}`).join(', ');
      const message = `Hello Art Palace, I am sharing my selection from the '${catalog.client_name}' catalog.\n\nCart ID: #${cartData.id}\nItems: ${itemSummary}\n\nPlease let me know the next steps.`;
      
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
    } catch (error) {
      alert("There was an issue preparing your cart.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const renderFilterSection = (title: string, type: 'category' | 'style' | 'collection', options: string[]) => {
    if (options.length === 0) return null;
    return (
      <div className="mb-6">
        <h4 className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-4">{title}</h4>
        <div className="space-y-3">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-3 text-sm text-neutral-700 cursor-pointer select-none group">
              <div className={`w-4 h-4 border flex items-center justify-center transition-colors ${filters[type].includes(opt) ? 'bg-neutral-900 border-neutral-900 text-white' : 'border-neutral-300 group-hover:border-neutral-500'}`}>
                {filters[type].includes(opt) && <span className="text-[10px]">✓</span>}
              </div>
              <input
                type="checkbox"
                checked={filters[type].includes(opt)}
                onChange={() => toggleFilter(type, opt)}
                className="hidden"
              />
              <span className="group-hover:text-neutral-900 capitalize">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 pb-28">
      <Script id="gtranslate-config" strategy="afterInteractive">
        {`window.gtranslateSettings = { default_language: "en", languages: ["en", "es", "fr", "de", "hi", "zh-CN"], wrapper_selector: ".gtranslate_wrapper", flag_style: "2d" };`}
      </Script>
      <Script src="https://cdn.gtranslate.net/widgets/latest/dropdown.js" strategy="afterInteractive" />

      <header className="bg-white border-b border-neutral-200 py-5 px-8 flex justify-between items-center sticky top-0 z-30">
        <div>
          <h1 className="text-xl tracking-widest uppercase font-light">Art Palace</h1>
          <p className="text-[10px] text-neutral-500 tracking-wider mt-1 uppercase">Exclusive Selection for <span className="font-medium text-neutral-800">{catalog.client_name}</span></p>
        </div>
       
        <div className="flex gap-4 items-center z-50">
          <div className="gtranslate_wrapper min-w-[120px]"></div>
         
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="border-b border-neutral-300 py-1 text-sm bg-transparent focus:outline-none uppercase tracking-widest"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="INR">INR (₹)</option>
            <option value="CNY">CNY (¥)</option>
          </select>
        </div>
      </header>

      <div className="w-full px-4 sm:px-8 py-8 flex gap-8 items-start">
       
        <aside className="w-56 shrink-0 hidden md:block sticky top-28 max-h-[80vh] overflow-y-auto pr-2 pb-12 sidebar-scroll">
          <div className="pb-4 border-b border-neutral-200 mb-6 sticky top-0 bg-white z-10">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-neutral-900">Filters</h3>
          </div>
         
          <div className="mb-6">
            <h4 className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-4">Price ({currency})</h4>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => handleNumberFilterChange('minPrice', e.target.value)}
                className="w-full border-b border-neutral-300 py-1 text-sm bg-transparent focus:outline-none focus:border-neutral-900 placeholder:text-neutral-400"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => handleNumberFilterChange('maxPrice', e.target.value)}
                className="w-full border-b border-neutral-300 py-1 text-sm bg-transparent focus:outline-none focus:border-neutral-900 placeholder:text-neutral-400"
              />
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-4">Weight (g)</h4>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.minWeight}
                onChange={(e) => handleNumberFilterChange('minWeight', e.target.value)}
                className="w-full border-b border-neutral-300 py-1 text-sm bg-transparent focus:outline-none focus:border-neutral-900 placeholder:text-neutral-400"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.maxWeight}
                onChange={(e) => handleNumberFilterChange('maxWeight', e.target.value)}
                className="w-full border-b border-neutral-300 py-1 text-sm bg-transparent focus:outline-none focus:border-neutral-900 placeholder:text-neutral-400"
              />
            </div>
          </div>

          {renderFilterSection('Category', 'category', filterOptions.category)}
          {renderFilterSection('Style', 'style', filterOptions.style)}
          {renderFilterSection('Collection', 'collection', filterOptions.collection)}
         
        </aside>

        <div className="flex-1">
          <div className="mb-6">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500">
              Showing <span className="font-bold text-neutral-900">{filteredProducts.length}</span> items
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
            {filteredProducts.map((product: any) => {
              if (!product) return null;
              const isSelected = !!cart.find(item => item.sku === product.id);
              return (
                <div
                  key={product.id}
                  className="group flex flex-col cursor-pointer"
                >
                  <div
                    className="relative w-full aspect-square bg-neutral-100 overflow-hidden mb-4"
                    onClick={() => setActiveProduct(product)}
                  >
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    <button
                      onClick={(e) => toggleCartItem(product, e)}
                      className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all z-10 ${
                        isSelected
                          ? 'bg-neutral-900 text-white'
                          : 'bg-white/80 text-neutral-600 hover:bg-white opacity-0 group-hover:opacity-100 backdrop-blur-sm'
                      }`}
                    >
                      {isSelected ? '✓' : '+'}
                    </button>
                    {isSelected && (
                      <div className="absolute top-4 left-4 bg-neutral-900 text-white text-[10px] px-2 py-1 uppercase tracking-widest">
                        Added
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <p className="text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5">{product.sku}</p>
                    <h2 className="text-sm font-medium text-neutral-900 line-clamp-2 leading-snug">{product.title}</h2>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-neutral-700">{currency} {getPrice(product.price_usd)}</span>
                      <button
                        onClick={() => setActiveProduct(product)}
                        className="text-[10px] uppercase tracking-widest text-neutral-500 hover:text-neutral-900 transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {activeProduct && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-200">
          <div className="bg-white max-w-5xl w-full h-[80vh] border border-neutral-200 shadow-2xl relative overflow-hidden flex flex-col md:flex-row">
            <button
              onClick={() => setActiveProduct(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 flex items-center justify-center z-10 transition-colors"
            >
              ✕
            </button>

            <div className="w-full md:w-3/5 bg-neutral-50 h-full">
              <img src={activeProduct?.image_url} alt={activeProduct?.title} className="w-full h-full object-cover" />
            </div>

            <div className="w-full md:w-2/5 p-10 flex flex-col justify-between h-full overflow-y-auto">
              <div>
                <p className="text-[10px] text-neutral-400 uppercase tracking-widest mb-2">SKU: {activeProduct?.sku}</p>
                <h2 className="text-2xl font-light text-neutral-900 mb-4">{activeProduct?.title}</h2>
                <p className="text-xl font-medium text-neutral-900 mb-6">{currency} {activeProduct?.price_usd ? getPrice(activeProduct.price_usd) : '0.00'}</p>
               
                <div
                  className="text-sm text-neutral-600 mb-8 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: activeProduct?.description || '' }}
                />
               
                <div className="space-y-4 border-t border-neutral-100 pt-6 text-sm text-neutral-600">
                 
                  {activeProduct?.weight && activeProduct.weight !== '0' && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-neutral-400">Weight</span>
                      <span className="text-right">{activeProduct.weight} g</span>
                    </div>
                  )}

                  {activeProduct?.category && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-neutral-400">Category</span>
                      <span className="text-right">{activeProduct.category}</span>
                    </div>
                  )}
                 
                  {activeProduct?.style && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-neutral-400">Style</span>
                      <span className="text-right">{activeProduct.style}</span>
                    </div>
                  )}

                  {activeProduct?.collection && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-neutral-400">Collection</span>
                      <span className="text-right">{activeProduct.collection}</span>
                    </div>
                  )}

                  {activeProduct?.stones && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-neutral-400">Stone Count</span>
                      <span className="text-right">{activeProduct.stones}</span>
                    </div>
                  )}

                  {activeProduct?.color && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-neutral-400">Color</span>
                      <span className="text-right capitalize">{activeProduct.color}</span>
                    </div>
                  )}

                  {activeProduct?.shape && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-neutral-400">Shape</span>
                      <span className="text-right capitalize">{activeProduct.shape}</span>
                    </div>
                  )}

                  {activeProduct?.cut && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-neutral-400">Stone Cut</span>
                      <span className="text-right capitalize">{activeProduct.cut}</span>
                    </div>
                  )}
                 
                  {activeProduct?.plating && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-neutral-400">Plating</span>
                      <span className="text-right capitalize">{activeProduct.plating}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-12 space-y-3 shrink-0">
                {(() => {
                  const currentCartItem = cart.find(item => item.sku === activeProduct?.sku);
                  if (currentCartItem) {
                    return (
                      <div className="flex items-center justify-between bg-neutral-100 border border-neutral-200 p-2">
                        <button 
                          onClick={(e) => updateQuantity(activeProduct.sku, -1, e)}
                          className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors"
                        >
                          -
                        </button>
                        <span className="text-sm font-semibold text-neutral-900">{currentCartItem.quantity} in Cart</span>
                        <button 
                          onClick={(e) => updateQuantity(activeProduct.sku, 1, e)}
                          className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    );
                  }
                  
                  return (
                    <button 
                      onClick={(e) => toggleCartItem(activeProduct, e)}
                      className="w-full py-4 text-xs uppercase tracking-widest font-semibold transition-colors border bg-neutral-900 border-neutral-900 text-white hover:bg-neutral-800"
                    >
                      Add to Cart
                    </button>
                  );
                })()}
                
                <button 
                  onClick={() => { if (activeProduct) { toggleCartItem(activeProduct); setActiveProduct(null); } }}
                  className="block text-center w-full bg-white text-red-600 py-4 text-xs uppercase tracking-widest font-semibold hover:bg-red-50 transition-colors"
                >
                  {cart.find(item => item.sku === activeProduct?.sku) ? 'Remove Entirely' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 text-white py-5 px-8 z-40 flex items-center justify-between animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Your Cart</p>
            <p className="text-sm font-medium">{totalItems} items <span className="mx-2 text-neutral-600">|</span> <span className="font-bold">{currency} {getPrice(totalUsdPrice)}</span></p>
          </div>
          <button onClick={() => setIsCartOpen(true)} className="bg-white text-neutral-900 px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 transition-colors">
            View Cart
          </button>
        </div>
      )}

      {/* Slide-over Cart Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h2 className="text-lg uppercase tracking-widest font-light">Your Cart</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-neutral-500 hover:text-neutral-900 font-bold">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cart.map(item => (
                <div key={item.sku} className="flex gap-4 items-center">
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-neutral-500">{item.sku}</p>
                    <h3 className="text-sm font-medium line-clamp-1">{item.title}</h3>
                    <p className="text-sm mt-1">{currency} {getPrice(item.price)}</p>
                  </div>
                  <div className="flex items-center border border-neutral-200">
                    <button onClick={() => updateQuantity(item.sku, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-neutral-100">-</button>
                    <span className="w-8 text-center text-xs">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.sku, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-neutral-100">+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-neutral-200 bg-neutral-50">
              <div className="flex justify-between mb-6 text-lg font-medium">
                <span>Total</span>
                <span>{currency} {getPrice(totalUsdPrice)}</span>
              </div>
              
              <div className="space-y-4 mb-6">
                <input 
                  type="email" 
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Email Address (Required for Payment Link)" 
                  className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900"
                />
                <input 
                  type="tel" 
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone Number (Required for Payment Link)" 
                  className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900"
                />
              </div>

              <div className="space-y-3">
                <button 
                  onClick={handlePaymentLinkRequest}
                  disabled={isCheckingOut}
                  className="w-full bg-neutral-900 text-white py-4 text-xs uppercase tracking-widest font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                >
                  {isCheckingOut ? 'Processing...' : 'Request Payment Link'}
                </button>
                <button 
                  onClick={handleWhatsAppInquiry}
                  disabled={isCheckingOut}
                  className="w-full bg-white text-neutral-900 border border-neutral-300 py-4 text-xs uppercase tracking-widest font-semibold hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                >
                  Inquire via WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}