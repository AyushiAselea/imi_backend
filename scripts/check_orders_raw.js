const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://imi_db_user:bvB0hZacJSlXLP3T@cluster0.aaivckn.mongodb.net/test?appName=Cluster0';

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const emails = ['aaravshrivastav89at@gmail.com', 'rickyraks05@gmail.com'];
  const users = await db.collection('users').find({ email: { $in: emails } }).toArray();

  for (const user of users) {
    const orders = await db.collection('orders').find({ user: user._id }).toArray();
    console.log('\n=== ' + user.email + ' ===');
    console.log(JSON.stringify(orders, null, 2));
  }
  await mongoose.disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
