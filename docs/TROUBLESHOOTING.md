
**`docs/TROUBLESHOOTING.md`**
```md
# Troubleshooting

## Electron / Shell
- Use cached Electron if ENOENT:
  ```powershell
  pnpm -F @nb/shell electron:get:win
  pnpm -F @nb/shell dev
