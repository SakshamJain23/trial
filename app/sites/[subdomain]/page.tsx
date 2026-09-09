import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hbvysrcyyxoemorrlyqt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhidnlzcmN5eXhvZW1vcnJseXF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzY5ODgsImV4cCI6MjEwNDUxMjk4OH0.CXOyZ65nqxWbCudFF2hvQlduiXDWjSJ0iWm1RrHIRZs';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function SitePage(props: {
  params: Promise<{ subdomain: string }>;
}) {
  const params = await props.params;
  const subdomain = params?.subdomain;

  const { data: site, error } = await supabase
    .from('sites')
    .select('*')
    .eq('subdomain', subdomain)
    .maybeSingle();

  if (error || !site) {
    return (
      <main style={{ padding: '40px', fontFamily: 'sans-serif' }}>
        <h1>404 - Store Not Found</h1>
        <p>Subdomain searched: {subdomain || 'None'}</p>
        <p>Error details: {error?.message || 'No record matched'}</p>
      </main>
    );
  }

  const layout = Array.isArray(site.layout) ? site.layout : [];

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>Storefront: {subdomain?.toUpperCase()}</h1>
      <hr style={{ margin: '20px 0' }} />

      {layout.map((block: any, index: number) => {
        if (!block || typeof block !== 'object') return null;

        if (block.type === 'video') {
          return (
            <div key={index} style={{ background: '#eee', padding: '20px', margin: '10px 0' }}>
              🎥 Video Player Block (URL: {block.url})
            </div>
          );
        }
        if (block.type === 'banners') {
          return (
            <div key={index} style={{ background: '#ddd', padding: '20px', margin: '10px 0' }}>
              🖼️ Banner Grid ({block.count} banners)
            </div>
          );
        }
        if (block.type === 'slideshow') {
          return (
            <div key={index} style={{ background: '#cfe2ff', padding: '20px', margin: '10px 0' }}>
              🔄 Slideshow Carousel ({block.count} slides)
            </div>
          );
        }
        if (block.type === 'circle_stones') {
          return (
            <div key={index} style={{ background: '#d1e7dd', padding: '20px', margin: '10px 0' }}>
              ⚪ Circle Stone Frames Section
            </div>
          );
        }
        if (block.type === 'image') {
          return (
            <div key={index} style={{ margin: '20px 0' }}>
              <img src={block.url} alt="Store Asset" style={{ maxWidth: '100%', borderRadius: '8px' }} />
            </div>
          );
        }
        return null;
      })}
    </main>
  );
}