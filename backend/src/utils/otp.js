const crypto = require('crypto');
const bcrypt = require('bcryptjs');

exports.generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

exports.generateInviteToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

exports.hashToken = async (token) => {
  return await bcrypt.hash(token, 12);
};
