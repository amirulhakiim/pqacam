export const KEY = 'homefinds:data:v1';
export const SESSION_KEY = 'homefinds:session:v1';
const WA = 'https://wa.me/60123456789?text=';
const PRODUCTS = [
  { id:'p1', name:'Ribbed Glass Tumbler Set (4 pcs)', cat:'Kitchen', price:'RM 24.90', tag:'Bestseller', tint:'oklch(0.9 0.03 200)',
    shopee:'https://shopee.com.my', tiktok:'https://www.tiktok.com/shop', wa:'',
    review:'I use these every single day for iced coffee. The glass is thicker than I expected and they survive the dishwasher. Only thing — the ribs make them a bit harder to clean with a sponge, so grab a straw brush too.' },
  { id:'p2', name:'Linen-look Cushion Cover', cat:'Decor', price:'RM 18.50', tag:'', tint:'oklch(0.9 0.035 70)',
    shopee:'https://shopee.com.my', tiktok:'', wa:'',
    review:'Soft, washes well and the oat colour goes with everything. Zip is hidden so it looks neat on the sofa. Get one size down from your insert for a plumper look.' },
  { id:'p3', name:'Stackable Fridge Organiser Bins', cat:'Storage', price:'RM 32.00', tag:'Restocked', tint:'oklch(0.9 0.03 150)',
    shopee:'', tiktok:'https://www.tiktok.com/shop', wa:'',
    review:'Changed my fridge life honestly. Clear so you can see what’s running out, and they stack without wobbling. Measure your shelf height first — the tall ones are tall!' },
  { id:'p4', name:'Handmade Ceramic Bud Vase', cat:'Decor', price:'RM 45.00', tag:'Small batch', tint:'oklch(0.9 0.035 40)',
    shopee:'', tiktok:'', wa: WA + encodeURIComponent('Hi! I would like to order the Ceramic Bud Vase'),
    review:'Made by a local potter friend, so every piece is slightly different. Perfect for one or two stems on a bedside table. Order by WhatsApp and she’ll send photos of available glazes.' },
  { id:'p5', name:'Wooden Dish Rack with Tray', cat:'Kitchen', price:'RM 59.90', tag:'', tint:'oklch(0.89 0.03 60)',
    shopee:'https://shopee.com.my', tiktok:'https://www.tiktok.com/shop', wa:'',
    review:'Looks so much nicer than plastic racks. The drip tray actually catches everything. Wipe it dry once a week and it stays nice — mine is 8 months old now.' },
  { id:'p6', name:'Microfibre Cleaning Cloths (10 pack)', cat:'Cleaning', price:'RM 12.90', tag:'Under RM15', tint:'oklch(0.9 0.03 260)',
    shopee:'https://shopee.com.my', tiktok:'https://www.tiktok.com/shop', wa:'',
    review:'Streak-free on mirrors with just water. I colour-code them: blue for glass, grey for kitchen. Cheap and they last.' },
  { id:'p7', name:'Rattan Storage Basket', cat:'Storage', price:'RM 38.00', tag:'', tint:'oklch(0.89 0.04 80)',
    shopee:'https://shopee.com.my', tiktok:'', wa: WA + encodeURIComponent('Hi! Is the Rattan Storage Basket available in large?'),
    review:'Holds all my throw blankets in the living room. Sturdy weave, no loose bits. Large size is only available direct — message me on WhatsApp for it.' },
  { id:'p8', name:'Soy Candle — Fig & Cedar', cat:'Decor', price:'RM 29.00', tag:'', tint:'oklch(0.9 0.03 20)',
    shopee:'', tiktok:'https://www.tiktok.com/shop', wa:'',
    review:'Not overpowering at all, just a warm cosy smell that fills a small room. Burns clean for about 30 hours. Trim the wick before each burn!' },
];
const MEDIA_SETS = [['photo','photo','video','photo'], ['photo','photo','photo'], ['video','photo','photo'], ['photo','video']];
PRODUCTS.forEach((p, i) => {
  let n = 0;
  p.tag = ''; p.hidden = false;
  p.media = MEDIA_SETS[i % MEDIA_SETS.length].map(t => ({ type:t, src:'', label: t === 'video' ? 'product video' : 'photo ' + (++n) }));
});
export const DEFAULTS = {
  profile: { name:'The Cosy Corner', handle:'@thecosycorner', avatar:'', whatsapp:'60123456789',
    bio:'Little things that make home feel softer. Everything here I’ve used myself — tap any item to read my honest review.' },
  categories: ['Kitchen', 'Decor', 'Storage', 'Cleaning'],
  admins: ['thecosycorner@gmail.com'],
  products: PRODUCTS,
};
export const TINTS = ['oklch(0.9 0.03 200)','oklch(0.9 0.035 70)','oklch(0.9 0.03 150)','oklch(0.9 0.035 40)','oklch(0.9 0.03 260)','oklch(0.9 0.03 20)'];
export function load() {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULTS));
}
export function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
export function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; } }
export function setSession(s) { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); }
export function resizeImage(file, max = 1000) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = rej;
    r.onload = () => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
