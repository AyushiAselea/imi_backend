const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://imi_db_user:bvB0hZacJSlXLP3T@cluster0.aaivckn.mongodb.net/test?appName=Cluster0';
const { ObjectId } = require('mongodb');

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // Check the product
  const product = await db.collection('products').findOne({ _id: new ObjectId('69a1aaffdc21a661488be9b0') });
  console.log('\n=== PRODUCT ===');
  console.log(JSON.stringify(product, null, 2));

  // Check carts for both users
  const emails = ['aaravshrivastav89at@gmail.com', 'rickyraks05@gmail.com'];
  const users = await db.collection('users').find({ email: { $in: emails } }).toArray();
  for (const user of users) {
    const cart = await db.collection('carts').findOne({ user: user._id });
    console.log('\n=== CART for ' + user.email + ' ===');
    console.log(JSON.stringify(cart, null, 2));
    
    // Also check abandoned carts
    const abCart = await db.collection('abandonedcarts').findOne({ user: user._id });
    console.log('\n=== ABANDONED CART for ' + user.email + ' ===');
    console.log(JSON.stringify(abCart, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
