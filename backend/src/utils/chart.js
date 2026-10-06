function groupByDate(data, key) {
  const map = {};
  for (const item of data) {
    if (!map[item[key]]) map[item[key]] = 0;
    map[item[key]] += Number(item.total);
  }
  return Object.entries(map).map(([label, value]) => ({
    label,
    value: Number(value.toFixed(2))
  }));
}

module.exports = {
  groupByDate
};
