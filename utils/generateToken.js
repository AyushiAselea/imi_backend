const jwt = require("jsonwebtoken");

/**
 * Generate a JWT token for a given user ID.
 * @param {string} id - The user's MongoDB _id
 * @returns {string} Signed JWT token
 */
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

module.exports = generateToken;
