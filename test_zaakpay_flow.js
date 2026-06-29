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
    const productList = Array.isArray(products) ? products : products.products;
    const productId = (Array.isArray(productList) && productList[0] && productList[0]._id) ? productList[0]._id : null;
    if (!productId) {
      console.error('No product available to test. Create a product first.');
      process.exit(1);
    }

    // 2) Register user (if already exists, ignore error)
    const testUser = { name: 'Test Zaakpay', email: 'testzaakpay@example.com', password: 'password123' };
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
      body: JSON.stringify({
        productId,
        quantity: 1,
        paymentMethod: 'ONLINE',
        shippingAddress: {
          fullName: 'Test Zaakpay',
          phone: '9999999999',
          addressLine1: '123 Test Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          country: 'India',
        },
      })
    });
    const payJson = await payRes.json();
    log('paymentCreate', payJson);

    if (payJson.paymentData) {
      console.log('\nZaakpay form action:', payJson.paymentData.action);
      console.log('Checksum generated:', payJson.paymentData.checksum);
      console.log('\nTo complete the test manually, submit these fields as a POST form to the action URL above,');
      console.log('or open imi-ai-smartwear checkout in the browser and use test card 4111 1111 1111 1111, CVV 123, Exp 07/29, OTP 1234.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Test script error:', err);
    process.exit(1);
  }
})();
