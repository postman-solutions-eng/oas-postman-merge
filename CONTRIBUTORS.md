# Contributors

Thank you to everyone who has contributed to making `oas-postman-merge` better! 🙏

## 🐛 Bug Reports & Fixes

### Critical Bug Fix: Postman Variable Matching

**Reporter:** Community Tester (using Cursor AI)  
**Date:** November 25, 2025  
**Impact:** Fixed critical bug causing 100% false retirement rate for collections using Postman variables

**What They Did:**
- Discovered that collections using `{{customVar}}` syntax were failing to match with OpenAPI-converted collections
- Provided comprehensive root cause analysis with code-level debugging
- Designed and tested a three-part fix:
  1. Prioritize path array over raw URL field
  2. Normalize path parameters (`{{var}}` and `:param` both normalize to `:param`)
  3. Preserve custom Postman variables during merge
- Created production-ready documentation and test cases
- **Built entirely using Cursor AI!** 🤖

**Result:** Zero false retirements, complete variable preservation, works for ANY collection format

---

## 🎯 How to Contribute

We welcome contributions! Here's how you can help:

1. **Report Bugs:** Found an issue? [Open an issue](https://github.com/postman-solutions-eng/oas-postman-merge/issues/new?template=bug_report.md)
2. **Suggest Features:** Have an idea? [Request a feature](https://github.com/postman-solutions-eng/oas-postman-merge/issues/new?template=feature_request.md)
3. **Submit PRs:** Fixed a bug or added a feature? Send us a pull request!
4. **Improve Docs:** See a typo or unclear section? Documentation improvements are always welcome!
5. **Share Your Experience:** Let us know how you're using the tool!

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

---

## 💝 Special Thanks

To all our testers, bug reporters, and feature requesters - you make this project better for everyone!

**Want to be listed here?** Make a meaningful contribution and we'll add you! 🚀


