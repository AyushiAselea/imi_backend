(async () => {
  const fetch = globalThis.fetch || (await import('node-fetch')).default;
  const base = process.env.BASE_URL || 'http://localhost:5000';

  const log = (label, obj) => {
    console.log('----', label, '----');
    try { console.log(JSON.stringify(obj, null, 2)); } catch (e) { console.log(obj); }
  }

  try {
    // 1) Get products
    const prodRes = await fetch(`${base}/api/products`);
    const products = await prodRes.json();
    log('products', products);
    const productId = (Array.isArray(products) && products[0] && products[0]._id) ? products[0]._id : null;
    if (!productId) {
      console.error('No product available to test. Create a product first.');
      process.exit(1);
    }

    // 2) Register user (if already exists, ignore error)
    const testUser = { name: 'Test PayU', email: 'testpayu@example.com', password: 'password123' };
    const regRes = await fetch(`${base}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(testUser)
    });
    const regJson = await regRes.json();
    log('register', regJson);

    // 3) Login to get token
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });
    const loginJson = await loginRes.json();
    log('login', loginJson);

    const token = loginJson.token;
    if (!token) {
      console.error('Could not obtain token; aborting test.');
      process.exit(1);
    }

    // 4) Call payment create
    const payRes = await fetch(`${base}/api/payment/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ productId, quantity: 1 })
    });
    const payJson = await payRes.json();
    log('paymentCreate', payJson);

    process.exit(0);
  } catch (err) {
    console.error('Test script error:', err);
    process.exit(1);
  }
})();
