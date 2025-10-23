import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
    rules: {
      // Giảm ồn: cho phép any khi cần nhanh
      "@typescript-eslint/no-explicit-any": "off",
      // Cho phép dùng <img> (ta có thể tối ưu sau bằng next/image)
      "@next/next/no-img-element": "off",
      // Cảnh báo nhẹ cho biến không dùng, bỏ qua biến bắt đầu bằng _
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    },
  },
];

export default eslintConfig;
