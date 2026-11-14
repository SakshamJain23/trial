'use client';

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import Script from 'next/script';

const supabaseUrl = 'https://hbvysrcyyxoemorrlyqt.supabase.co';
// Replace this placeholder with your Supabase anon/public key (or use an environment variable).
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhidnlzcmN5eXhvZW1vcnJseXF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzY5ODgsImV4cCI6MjEwNDUxMjk4OH0.CXOyZ65nqxWbCudFF2hvQlduiXDWjSJ0iWm1RrHIRZs';
const supabase = createClient(supabaseUrl, supabaseKey);

type CartItem = { sku: string; quantity: number; price: number; title: string; image_url: string; design_id: string };

export default function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const [catalog, setCatalog] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProduct, setActiveProduct] = useState<any>(null);
  
  // Cart & Checkout State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
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
          id: v.sku, sku: v.sku, design_id: String(v.products?.id || v.sku),
          price_usd: v.price_usd, stones: v.number_of_stones,
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

  if (loading) return <div className="p-16 text-center text-[#718096] uppercase tracking-widest text-sm">Loading collection...</div>;
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
      return [...prev, { sku: product.sku, quantity: 1, price: product.price_usd, title: product.title, image_url: product.image_url || '', design_id: String(product.design_id || product.sku) }];
    });
  };

  const updateQuantity = (sku: string, delta: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCart(prev => prev.flatMap(item => {
      if (item.sku !== sku) return [item];
      const nextQuantity = item.quantity + delta;
      return nextQuantity <= 0 ? [] : [{ ...item, quantity: nextQuantity }];
    }));
  };

  const addOneToCart = (product: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCart(prev => {
      const existing = prev.find(item => item.sku === product.sku);
      if (existing) {
        return prev.map(item => item.sku === product.sku ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        sku: product.sku, quantity: 1, price: product.price_usd,
        title: product.title, image_url: product.image_url || '',
        design_id: String(product.design_id || product.sku)
      }];
    });
  };

  // MOQ is counted across all variants linked to the same products.id.
  const designQuantities = cart.reduce((groups, item) => {
    const key = item.design_id || item.sku;
    groups[key] = (groups[key] || 0) + item.quantity;
    return groups;
  }, {} as Record<string, number>);
  const designsBelowMoq = Object.entries(designQuantities).filter(([, quantity]) => quantity < 3);
  const moqIsMet = cart.length > 0 && designsBelowMoq.length === 0;

  const validateMoq = () => {
    if (cart.length === 0) {
      alert("Please add products to your cart first.");
      return false;
    }
    if (designsBelowMoq.length > 0) {
      alert("Each design requires a minimum of 3 pieces. Different variants of the same design count together. Please add more pieces before submitting your inquiry.");
      return false;
    }
    return true;
  };

  const totalUsdPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Checkout Handlers
  const handlePaymentLinkRequest = async () => {
    if (!validateMoq()) return;
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
    if (!validateMoq()) return;
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
        <h4 className="text-[10px] uppercase tracking-wider font-semibold text-[#718096] mb-4">{title}</h4>
        <div className="space-y-3">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-3 text-sm text-[#34445D] cursor-pointer select-none group">
              <div className={`w-4 h-4 border flex items-center justify-center transition-colors ${filters[type].includes(opt) ? 'bg-[#173B78] border-[#173B78] text-white' : 'border-[#CBD6E6] group-hover:border-[#173B78]'}`}>
                {filters[type].includes(opt) && <span className="text-[10px]">✓</span>}
              </div>
              <input
                type="checkbox"
                checked={filters[type].includes(opt)}
                onChange={() => toggleFilter(type, opt)}
                className="hidden"
              />
              <span className="group-hover:text-[#173B78] capitalize">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white font-sans text-[#173B78] pb-28">
      <Script id="gtranslate-config" strategy="afterInteractive">
        {`window.gtranslateSettings = { default_language: "en", languages: ["en", "es", "fr", "de", "hi", "zh-CN"], wrapper_selector: ".gtranslate_wrapper", flag_style: "2d" };`}
      </Script>
      <Script src="https://cdn.gtranslate.net/widgets/latest/dropdown.js" strategy="afterInteractive" />

      <div className="bg-[#173B78] text-white px-3 py-2 text-center tracking-[0.18em] uppercase text-[9px] sm:text-[10px] font-semibold">
        <span className="text-[#F3D9A6]">✦</span> Christmas 2026 <span className="text-[#F3D9A6]">✦</span> A Season of Gifting & Sparkle <span className="text-[#F3D9A6]">✦</span>
      </div>
      <header className="bg-white border-b border-[#DCE5F2] py-3 sm:py-5 px-4 sm:px-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sticky top-0 z-30 shadow-[0_2px_12px_rgba(23,59,120,0.05)]">
        <div className="min-w-0">

          <h1 className="text-xl tracking-[0.22em] uppercase font-light text-[#173B78]">Art Palace</h1>
          <p className="text-[10px] text-[#718096] tracking-wider mt-1 uppercase">Exclusive Selection for <span className="font-medium text-[#173B78]">{catalog.client_name}</span></p>
        </div>
       
        <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-between sm:justify-end z-50 w-full sm:w-auto">
          <div className="gtranslate_wrapper min-w-[105px] max-w-full text-sm"></div>
         
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="border-b border-[#CBD6E6] py-2 text-sm bg-white focus:outline-none uppercase tracking-widest min-w-[112px] max-w-full"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="INR">INR (₹)</option>
            <option value="CNY">CNY (¥)</option>
          </select>
        </div>
      </header>

      <div className="w-full px-3 sm:px-8 py-5 sm:py-8 flex gap-8 items-start">
       
        <aside className="w-56 shrink-0 hidden md:block sticky top-28 max-h-[80vh] overflow-y-auto pr-2 pb-12 sidebar-scroll">
          <div className="pb-4 border-b border-[#DCE5F2] mb-6 sticky top-0 bg-white z-10">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-[#173B78]">Filters</h3>
          </div>
         
          <div className="mb-6">
            <h4 className="text-[10px] uppercase tracking-wider font-semibold text-[#718096] mb-4">Price ({currency})</h4>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => handleNumberFilterChange('minPrice', e.target.value)}
                className="w-full border-b border-[#CBD6E6] py-1 text-sm bg-transparent focus:outline-none focus:border-[#173B78] placeholder:text-[#9AA7B8]"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => handleNumberFilterChange('maxPrice', e.target.value)}
                className="w-full border-b border-[#CBD6E6] py-1 text-sm bg-transparent focus:outline-none focus:border-[#173B78] placeholder:text-[#9AA7B8]"
              />
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-[10px] uppercase tracking-wider font-semibold text-[#718096] mb-4">Weight (g)</h4>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.minWeight}
                onChange={(e) => handleNumberFilterChange('minWeight', e.target.value)}
                className="w-full border-b border-[#CBD6E6] py-1 text-sm bg-transparent focus:outline-none focus:border-[#173B78] placeholder:text-[#9AA7B8]"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.maxWeight}
                onChange={(e) => handleNumberFilterChange('maxWeight', e.target.value)}
                className="w-full border-b border-[#CBD6E6] py-1 text-sm bg-transparent focus:outline-none focus:border-[#173B78] placeholder:text-[#9AA7B8]"
              />
            </div>
          </div>

          {renderFilterSection('Category', 'category', filterOptions.category)}
          {renderFilterSection('Style', 'style', filterOptions.style)}
          {renderFilterSection('Collection', 'collection', filterOptions.collection)}
         
        </aside>

        <div className="flex-1">
          <div className="mb-5 sm:mb-6 flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-widest text-[#718096]">
              Showing <span className="font-bold text-[#173B78]">{filteredProducts.length}</span> items
            </span>
            <button
              type="button"
              onClick={() => setIsFiltersOpen(true)}
              className="md:hidden shrink-0 inline-flex items-center gap-2 border border-[#173B78] rounded-sm px-4 py-2.5 text-[10px] uppercase tracking-widest font-bold bg-[#173B78] text-white shadow-sm"
              aria-label="Open filters"
            >
              <span aria-hidden="true">☷</span> Filters
              {(filters.category.length + filters.style.length + filters.collection.length +
                (filters.minPrice !== '' ? 1 : 0) + (filters.maxPrice !== '' ? 1 : 0) +
                (filters.minWeight !== '' ? 1 : 0) + (filters.maxWeight !== '' ? 1 : 0)) > 0 && (
                <span className="bg-[#B92735] text-white rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                  {filters.category.length + filters.style.length + filters.collection.length +
                    (filters.minPrice !== '' ? 1 : 0) + (filters.maxPrice !== '' ? 1 : 0) +
                    (filters.minWeight !== '' ? 1 : 0) + (filters.maxWeight !== '' ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-3 sm:gap-x-6 gap-y-8 sm:gap-y-12">
            {filteredProducts.map((product: any) => {
              if (!product) return null;
              const isSelected = !!cart.find(item => item.sku === product.id);
              return (
                <div
                  key={product.id}
                  className="group flex flex-col cursor-pointer"
                >
                  <div
                    className="relative w-full aspect-square bg-[#F1F5FB] overflow-hidden mb-4"
                    onClick={() => setActiveProduct(product)}
                  >
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    {!isSelected && (
                      <button
                        onClick={(e) => addOneToCart(product, e)}
                        className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 bg-[#B92735] text-white py-2.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider shadow-sm hover:bg-[#9F1F2B] transition-colors z-10"
                      >
                        + Quick Add
                      </button>
                    )}
                    {isSelected && (
                      <div className="absolute top-3 left-3 bg-[#173B78] text-white text-[10px] px-2 py-1 uppercase tracking-widest">
                        In Cart
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <p className="text-[9px] text-[#8A98AA] uppercase tracking-widest mb-1.5">{product.sku}</p>
                    <h2 className="text-sm font-medium text-[#173B78] line-clamp-2 leading-snug">{product.title}</h2>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <span className="text-sm text-[#34445D]">{currency} {getPrice(product.price_usd)}</span>
                      <button
                        onClick={() => setActiveProduct(product)}
                        className="text-[10px] uppercase tracking-widest text-[#718096] hover:text-[#173B78] transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                    {isSelected && (
                      <div className="mt-3 flex items-center justify-between border border-[#DCE5F2] bg-[#F7F9FC] px-2 py-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-[#53647D]">Quantity</span>
                        <div className="flex items-center gap-3">
                          <button type="button" aria-label={`Decrease quantity of ${product.title}`} onClick={(e) => updateQuantity(product.sku, -1, e)} className="w-7 h-7 text-[#173B78] font-semibold">−</button>
                          <span className="min-w-4 text-center text-sm font-semibold text-[#173B78]">{cart.find(item => item.sku === product.sku)?.quantity || 1}</span>
                          <button type="button" aria-label={`Increase quantity of ${product.title}`} onClick={(e) => addOneToCart(product, e)} className="w-7 h-7 text-[#173B78] font-semibold">+</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {isFiltersOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setIsFiltersOpen(false)}
            className="absolute inset-0 bg-[#173B78]/40 backdrop-blur-sm"
          />
          <aside className="relative ml-auto w-[min(88vw,360px)] h-[100dvh] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-5 border-b border-[#DCE5F2]">
              <h3 className="text-xs uppercase tracking-widest font-semibold">Filters</h3>
              <button type="button" onClick={() => setIsFiltersOpen(false)} className="w-9 h-9 flex items-center justify-center text-[#53647D]" aria-label="Close filters">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-6">
                <h4 className="text-[10px] uppercase tracking-wider font-semibold text-[#718096] mb-4">Price ({currency})</h4>
                <div className="flex gap-3">
                  <input type="number" inputMode="decimal" placeholder="Min" value={filters.minPrice}
                    onChange={(e) => handleNumberFilterChange('minPrice', e.target.value)}
                    className="w-full min-w-0 border-b border-[#CBD6E6] py-2 text-sm bg-transparent focus:outline-none focus:border-[#173B78] placeholder:text-[#9AA7B8]" />
                  <input type="number" inputMode="decimal" placeholder="Max" value={filters.maxPrice}
                    onChange={(e) => handleNumberFilterChange('maxPrice', e.target.value)}
                    className="w-full min-w-0 border-b border-[#CBD6E6] py-2 text-sm bg-transparent focus:outline-none focus:border-[#173B78] placeholder:text-[#9AA7B8]" />
                </div>
              </div>
              <div className="mb-6">
                <h4 className="text-[10px] uppercase tracking-wider font-semibold text-[#718096] mb-4">Weight (g)</h4>
                <div className="flex gap-3">
                  <input type="number" inputMode="decimal" placeholder="Min" value={filters.minWeight}
                    onChange={(e) => handleNumberFilterChange('minWeight', e.target.value)}
                    className="w-full min-w-0 border-b border-[#CBD6E6] py-2 text-sm bg-transparent focus:outline-none focus:border-[#173B78] placeholder:text-[#9AA7B8]" />
                  <input type="number" inputMode="decimal" placeholder="Max" value={filters.maxWeight}
                    onChange={(e) => handleNumberFilterChange('maxWeight', e.target.value)}
                    className="w-full min-w-0 border-b border-[#CBD6E6] py-2 text-sm bg-transparent focus:outline-none focus:border-[#173B78] placeholder:text-[#9AA7B8]" />
                </div>
              </div>
              {renderFilterSection('Category', 'category', filterOptions.category)}
              {renderFilterSection('Style', 'style', filterOptions.style)}
              {renderFilterSection('Collection', 'collection', filterOptions.collection)}
            </div>
            <div className="p-4 border-t border-[#DCE5F2] flex gap-3 bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <button type="button" onClick={() => setFilters({
                category: [], style: [], collection: [], minPrice: '', maxPrice: '', minWeight: '', maxWeight: ''
              })} className="flex-1 border border-[#CBD6E6] py-3 text-[10px] uppercase tracking-widest font-semibold">
                Clear all
              </button>
              <button type="button" onClick={() => setIsFiltersOpen(false)} className="flex-1 bg-[#173B78] text-white py-3 text-[10px] uppercase tracking-widest font-semibold">
                Show {filteredProducts.length} items
              </button>
            </div>
          </aside>
        </div>
      )}

      {activeProduct && (
        <div className="fixed inset-0 bg-white/95 sm:bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 md:p-12 animate-in fade-in duration-200">
          <div className="bg-white max-w-5xl w-full h-[100dvh] sm:h-[85vh] md:h-[80vh] sm:border border-[#DCE5F2] shadow-2xl relative overflow-y-auto sm:overflow-hidden flex flex-col md:flex-row">
            <button
              onClick={() => setActiveProduct(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-[#F1F5FB] hover:bg-[#E7EDF6] text-[#173B78] flex items-center justify-center z-10 transition-colors"
            >
              ✕
            </button>

            <div className="w-full md:w-3/5 bg-[#F7F9FC] h-[42vh] min-h-[260px] md:h-full shrink-0">
              <img src={activeProduct?.image_url} alt={activeProduct?.title} className="w-full h-full object-contain md:object-cover" />
            </div>

            <div className="w-full md:w-2/5 p-5 sm:p-8 md:p-10 flex flex-col justify-between md:h-full md:overflow-y-auto">
              <div>
                <p className="text-[10px] text-[#8A98AA] uppercase tracking-widest mb-2">SKU: {activeProduct?.sku}</p>
                <h2 className="text-2xl font-light text-[#173B78] mb-4">{activeProduct?.title}</h2>
                <p className="text-xl font-medium text-[#173B78] mb-6">{currency} {activeProduct?.price_usd ? getPrice(activeProduct.price_usd) : '0.00'}</p>
               
                <div
                  className="text-sm text-[#53647D] mb-8 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: activeProduct?.description || '' }}
                />
               
                <div className="space-y-4 border-t border-neutral-100 pt-6 text-sm text-[#53647D]">
                 
                  {activeProduct?.weight && activeProduct.weight !== '0' && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-[#8A98AA]">Weight</span>
                      <span className="text-right">{activeProduct.weight} g</span>
                    </div>
                  )}

                  {activeProduct?.category && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-[#8A98AA]">Category</span>
                      <span className="text-right">{activeProduct.category}</span>
                    </div>
                  )}
                 
                  {activeProduct?.style && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-[#8A98AA]">Style</span>
                      <span className="text-right">{activeProduct.style}</span>
                    </div>
                  )}

                  {activeProduct?.collection && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-[#8A98AA]">Collection</span>
                      <span className="text-right">{activeProduct.collection}</span>
                    </div>
                  )}

                  {activeProduct?.stones && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-[#8A98AA]">Stone Count</span>
                      <span className="text-right">{activeProduct.stones}</span>
                    </div>
                  )}

                  {activeProduct?.color && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-[#8A98AA]">Color</span>
                      <span className="text-right capitalize">{activeProduct.color}</span>
                    </div>
                  )}

                  {activeProduct?.shape && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-[#8A98AA]">Shape</span>
                      <span className="text-right capitalize">{activeProduct.shape}</span>
                    </div>
                  )}

                  {activeProduct?.cut && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-[#8A98AA]">Stone Cut</span>
                      <span className="text-right capitalize">{activeProduct.cut}</span>
                    </div>
                  )}
                 
                  {activeProduct?.plating && (
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="uppercase tracking-widest text-[10px] font-semibold text-[#8A98AA]">Plating</span>
                      <span className="text-right capitalize">{activeProduct.plating}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 md:mt-12 space-y-3 shrink-0 pb-4">
                {(() => {
                  const currentCartItem = cart.find(item => item.sku === activeProduct?.sku);
                  if (currentCartItem) {
                    return (
                      <div className="flex items-center justify-between bg-[#F1F5FB] border border-[#DCE5F2] p-2">
                        <button 
                          onClick={(e) => updateQuantity(activeProduct.sku, -1, e)}
                          className="w-10 h-10 flex items-center justify-center text-[#53647D] hover:bg-[#E7EDF6] hover:text-[#173B78] transition-colors"
                        >
                          -
                        </button>
                        <span className="text-sm font-semibold text-[#173B78]">{currentCartItem.quantity} in Cart</span>
                        <button 
                          onClick={(e) => updateQuantity(activeProduct.sku, 1, e)}
                          className="w-10 h-10 flex items-center justify-center text-[#53647D] hover:bg-[#E7EDF6] hover:text-[#173B78] transition-colors"
                        >
                          +
                        </button>
                      </div>
                    );
                  }
                  
                  return (
                    <button 
                      onClick={(e) => toggleCartItem(activeProduct, e)}
                      className="w-full py-4 text-xs uppercase tracking-widest font-semibold transition-colors border bg-[#B92735] border-[#B92735] text-white hover:bg-[#98202C]"
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
        <div className="fixed bottom-0 left-0 right-0 bg-[#173B78] text-white py-3 sm:py-5 px-4 sm:px-8 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:pb-5 z-40 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#8A98AA] mb-1">Your Cart</p>
            <p className="text-sm font-medium">{totalItems} items <span className="mx-2 text-[#53647D]">|</span> <span className="font-bold">{currency} {getPrice(totalUsdPrice)}</span></p>
          </div>
          <button onClick={() => setIsCartOpen(true)} className="bg-white text-[#173B78] px-4 sm:px-8 py-3 text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap hover:bg-[#E7EDF6] transition-colors">
            View Cart
          </button>
        </div>
      )}

      {/* Slide-over Cart Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-[#173B78]/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-[100dvh] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b border-[#DCE5F2]">
              <h2 className="text-lg uppercase tracking-widest font-light">Your Cart</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-[#718096] hover:text-[#173B78] font-bold">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {cart.length > 0 && (
                <div className={`border p-3 ${moqIsMet ? 'border-[#B7D7C3] bg-[#F1F8F3]' : 'border-[#E7C5C9] bg-[#FFF6F6]'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${moqIsMet ? 'text-[#27633A]' : 'text-[#B92735]'}`}>
                    {moqIsMet ? 'Minimum order quantity achieved' : 'Minimum order quantity required'}
                  </p>
                  <p className="text-xs text-[#53647D] mt-1">
                    Minimum 3 pieces per design. Different variants of the same design count together.
                  </p>
                  {!moqIsMet && (
                    <div className="mt-2 space-y-1">
                      {designsBelowMoq.map(([designId, quantity]) => (
                        <p key={designId} className="text-xs text-[#B92735]">
                          {cart.find(item => item.design_id === designId)?.title || 'Design'}: {quantity}/3 pieces — add {3 - quantity} more
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {cart.map(item => (
                <div key={item.sku} className="flex gap-3 sm:gap-4 items-center">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 overflow-hidden border border-[#DCE5F2] bg-[#F7F9FC]">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-[#8A98AA]">
                        NO IMAGE
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-[#718096]">{item.sku}</p>
                    <h3 className="text-sm font-medium leading-snug text-[#173B78] line-clamp-2">{item.title}</h3>
                    <p className="text-sm mt-1 text-[#173B78]">{currency} {getPrice(item.price)}</p>
                  </div>
                  <div className="flex items-center shrink-0 border border-[#DCE5F2]">
                    <button onClick={() => updateQuantity(item.sku, -1)} aria-label={`Decrease quantity of ${item.title}`} className="w-7 h-8 sm:w-8 flex items-center justify-center hover:bg-[#F1F5FB]">-</button>
                    <span className="w-7 sm:w-8 text-center text-xs">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.sku, 1)} aria-label={`Increase quantity of ${item.title}`} className="w-7 h-8 sm:w-8 flex items-center justify-center hover:bg-[#F1F5FB]">+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 sm:p-6 border-t border-[#DCE5F2] bg-[#F7F9FC] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              {cart.length > 0 && !moqIsMet && (
                <p className="text-xs text-[#B92735] mb-3">Complete the 3-piece minimum for each design to submit your order inquiry.</p>
              )}
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
                  className="w-full border border-[#CBD6E6] px-3 py-2 text-sm focus:outline-none focus:border-[#173B78]"
                />
                <input 
                  type="tel" 
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone Number (Required for Payment Link)" 
                  className="w-full border border-[#CBD6E6] px-3 py-2 text-sm focus:outline-none focus:border-[#173B78]"
                />
              </div>

              <div className="space-y-3">
                <button 
                  onClick={handlePaymentLinkRequest}
                  disabled={isCheckingOut}
                  className="w-full bg-[#B92735] text-white py-4 text-xs uppercase tracking-widest font-semibold hover:bg-[#98202C] disabled:opacity-50 transition-colors"
                >
                  {isCheckingOut ? 'Processing...' : 'Request Payment Link'}
                </button>
                <button 
                  onClick={handleWhatsAppInquiry}
                  disabled={isCheckingOut}
                  className="w-full bg-[#173B78] text-white border border-[#173B78] py-4 text-xs uppercase tracking-widest font-semibold hover:bg-[#102A59] disabled:opacity-50 transition-colors"
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