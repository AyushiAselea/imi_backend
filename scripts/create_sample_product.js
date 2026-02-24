require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const existing = await Product.findOne({ name: 'Sample PayU Product' });
    if (existing) {
      console.log('Sample product already exists:', existing._id);
      process.exit(0);
    }

    const product = await Product.create({
      name: 'Sample PayU Product',
      description: 'A product created for PayU integration testing',
      price: 99.99,
      image: '',
      stock: 10,
    });

    console.log('Created product with id:', product._id);
    process.exit(0);
  } catch (err) {
    console.error('Error creating product:', err);
    process.exit(1);
  }
};

run();
