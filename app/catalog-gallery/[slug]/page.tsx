'use client';

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import Script from 'next/script';

const supabaseUrl = 'https://hbvysrcyyxoemorrlyqt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhidnlzcmN5eXhvZW1vcnJseXF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzY5ODgsImV4cCI6MjEwNDUxMjk4OH0.CXOyZ65nqxWbCudFF2hvQlduiXDWjSJ0iWm1RrHIRZs';
const supabase = createClient(supabaseUrl, supabaseKey);

type CartItem = { sku: string; quantity: number };

export default function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
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
          sku,
          product_images (image_src)
        `)
        .in('sku', skus);

      if (!variantsError && variantsData) {
        const formattedProducts = variantsData.map((v: any) => ({
          id: v.sku, 
          sku: v.sku, 
          image_url: v.product_images?.[0]?.image_src || ''
        }));
        
        setProducts(formattedProducts);
      } else if (variantsError) {
        console.error("Supabase Query Error:", variantsError);
      }

      setLoading(false);
    }
    loadData();
  }, [params]);

  if (loading) return <div className="p-16 text-center text-neutral-500 uppercase tracking-widest text-sm">Loading gallery...</div>;
  if (!catalog) return <div className="p-16 text-center text-red-500 font-semibold uppercase tracking-widest text-sm">Gallery not found.</div>;

  // Cart Functions
  const toggleCartItem = (product: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCart(prev => {
      const exists = prev.find(item => item.sku === product.sku);
      if (exists) return prev.filter(item => item.sku !== product.sku);
      return [...prev, { sku: product.sku, quantity: 1 }];
    });
  };

  const updateQuantity = (sku: string, delta: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCart(prev => prev.map(item => {
      if (item.sku === sku) return { ...item, quantity: Math.max(1, item.quantity + delta) };
      return item;
    }));
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Checkout Handlers
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

      const itemsToInsert = cart.map(item => ({ cart_id: cartData.id, sku: item.sku, quantity: item.quantity, price: 0 }));
      await supabase.from('cart_items').insert(itemsToInsert);

      const whatsappNumber = "919829033766";
      const itemSummary = cart.map(item => `${item.quantity}x ${item.sku}`).join(', ');
      const message = `Hello Art Palace, I am sharing my selection from the '${catalog.client_name}' photo gallery.\n\nSelection ID: #${cartData.id}\nItems: ${itemSummary}\n\nPlease let me know the next steps.`;
      
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
    } catch (error) {
      alert("There was an issue preparing your selection.");
    } finally {
      setIsCheckingOut(false);
    }
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
          <p className="text-[10px] text-neutral-500 tracking-wider mt-1 uppercase">Photo Gallery for <span className="font-medium text-neutral-800">{catalog.client_name}</span></p>
        </div>
        
        <div className="flex gap-4 items-center z-50">
          <div className="gtranslate_wrapper min-w-[120px]"></div>
        </div>
      </header>

      <div className="w-full px-4 sm:px-8 py-8">
        <div className="mb-6 flex justify-between items-center border-b border-neutral-100 pb-4">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500">
            Showing <span className="font-bold text-neutral-900">{products.length}</span> designs
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-10">
          {products.map((product: any) => {
            if (!product) return null;
            const isSelected = !!cart.find(item => item.sku === product.id);
            return (
              <div key={product.id} className="group flex flex-col cursor-pointer items-center">
                <div 
                  className="relative w-full aspect-square bg-neutral-50 overflow-hidden mb-3 border border-neutral-100"
                  onClick={() => setActiveProduct(product)}
                >
                  <img
                    src={product.image_url}
                    alt={product.sku}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <button
                    onClick={(e) => toggleCartItem(product, e)}
                    className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all z-10 shadow-sm ${
                      isSelected
                        ? 'bg-neutral-900 text-white'
                        : 'bg-white/90 text-neutral-600 hover:bg-white opacity-0 group-hover:opacity-100 backdrop-blur-sm'
                    }`}
                  >
                    {isSelected ? '✓' : '+'}
                  </button>
                  {isSelected && (
                    <div className="absolute top-3 left-3 bg-neutral-900 text-white text-[9px] px-2 py-1 uppercase tracking-widest">
                      Selected
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-neutral-800 tracking-wider">{product.sku}</p>
              </div>
            );
          })}
        </div>
      </div>

      {activeProduct && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
          <div className="bg-white max-w-4xl w-full max-h-[90vh] shadow-2xl relative flex flex-col items-center p-6 border border-neutral-200">
            <button
              onClick={() => setActiveProduct(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-full flex items-center justify-center z-10 transition-colors"
            >
              ✕
            </button>

            <div className="w-full h-[60vh] flex justify-center bg-neutral-50 mb-6">
              <img src={activeProduct?.image_url} alt={activeProduct?.sku} className="h-full w-auto object-contain" />
            </div>
            
            <h2 className="text-xl tracking-widest uppercase font-medium text-neutral-900 mb-6">{activeProduct?.sku}</h2>
            
            <div className="w-full max-w-xs flex gap-3">
              {(() => {
                const isSelected = !!cart.find(item => item.sku === activeProduct?.sku);
                return (
                  <button 
                    onClick={() => { toggleCartItem(activeProduct); setActiveProduct(null); }}
                    className={`flex-1 py-3 text-xs uppercase tracking-widest font-semibold transition-colors border ${
                      isSelected 
                        ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' 
                        : 'bg-neutral-900 border-neutral-900 text-white hover:bg-neutral-800'
                    }`}
                  >
                    {isSelected ? 'Remove Selection' : 'Select Design'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 text-white py-5 px-8 z-40 flex items-center justify-between animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Your Selection</p>
            <p className="text-sm font-medium">{totalItems} designs selected</p>
          </div>
          <button onClick={() => setIsCartOpen(true)} className="bg-white text-neutral-900 px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 transition-colors">
            Review Selection
          </button>
        </div>
      )}

      {/* Slide-over Selection Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h2 className="text-lg uppercase tracking-widest font-light">Selected Designs</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-neutral-500 hover:text-neutral-900 font-bold">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cart.map(item => (
                <div key={item.sku} className="flex gap-4 items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium tracking-wider uppercase">{item.sku}</h3>
                  </div>
                  <div className="flex items-center border border-neutral-200">
                    <button onClick={() => updateQuantity(item.sku, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-neutral-100">-</button>
                    <span className="w-8 text-center text-xs">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.sku, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-neutral-100">+</button>
                  </div>
                  <button onClick={() => toggleCartItem({sku: item.sku})} className="text-xs text-red-500 hover:text-red-700 underline ml-2">Remove</button>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-neutral-200 bg-neutral-50">
              <div className="space-y-4 mb-6">
                <input 
                  type="email" 
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Email Address (Optional)" 
                  className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900"
                />
                <input 
                  type="tel" 
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone Number (Optional)" 
                  className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900"
                />
              </div>

              <button 
                onClick={handleWhatsAppInquiry}
                disabled={isCheckingOut}
                className="w-full bg-neutral-900 text-white py-4 text-xs uppercase tracking-widest font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
              >
                {isCheckingOut ? 'Processing...' : 'Send Selection via WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}