Always resolve errors. Always resolve warnings. Pay ATTENTION to the pre-push. Pay attention to warnings.

(tf_env_py312) ethankennerly@Ethans-MacBook-Air usertest-recorder-nextjs % git push
+ unset NODE_OPTIONS
+ unset VSCODE_INSPECTOR_OPTIONS
+ npm run --silent ci:check

/Users/ethankennerly/Documents/React/usertest-recorder-nextjs/app/page.tsx
  76:15  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

✖ 1 problem (0 errors, 1 warning)
