const isGenerated = (file) =>
  file.includes("apps/ui/data/generated/") || file.includes("apps/api/generated/");

module.exports = {
  "*.{ts,tsx,js,jsx}": (files) => {
    const filtered = files.filter((file) => !isGenerated(file));
    if (filtered.length === 0) {
      return [];
    }
    return `eslint --max-warnings=0 ${filtered.join(" ")}`;
  }
};
