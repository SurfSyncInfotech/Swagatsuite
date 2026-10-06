function generateRestaurantCode() {
  const stamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RST-${stamp}${random}`;
}

function generatePassword() {
  return `restro@${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  generateRestaurantCode,
  generatePassword
};
