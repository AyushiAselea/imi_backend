const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://imi_db_user:bvB0hZacJSlXLP3T@cluster0.aaivckn.mongodb.net/test?appName=Cluster0';

const userSchema = new mongoose.Schema({ email: String, name: String }, { strict: false });
const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  products: [{ productName: String, variant: String, quantity: Number, price: Number }],
  totalAmount: Number,
  createdAt: Date,
  paymentStatus: String,
  status: String
}, { strict: false });

const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);

async function run() {
  await mongoose.connect(MONGO_URI);
  const emails = ['aaravshrivastav89at@gmail.com', 'rickyraks05@gmail.com'];
  const users = await User.find({ email: { $in: emails } }).lean();
  const orders = await Order.find({ user: { $in: users.map(u => u._id) } }).lean();

  for (const email of emails) {
    const user = users.find(u => u.email === email);
    if (!user) { console.log(email + ': No account found'); continue; }
    const userOrders = orders.filter(o => o.user.toString() === user._id.toString());
    if (!userOrders.length) { console.log(email + ': No orders found'); continue; }
    console.log('\n=== ' + email + ' ===');
    for (const o of userOrders) {
      for (const p of o.products) {
        const name = p.productName || 'Unknown';
        console.log('  Product: ' + name + ' | Variant/Color: ' + (p.variant || 'N/A') + ' | Qty: ' + p.quantity + ' | Payment: ' + (o.paymentStatus || o.status || 'N/A') + ' | Date: ' + (o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN') : 'N/A'));
      }
    }
  }
  await mongoose.disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
