# Contributing to OAS Postman Merge

Thank you for your interest in contributing to OAS Postman Merge! This project helps teams maintain curated Postman collections while keeping them synchronized with evolving OpenAPI specifications.

## 🚀 Quick Start

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR-USERNAME/oas-postman-merge.git`
3. **Install** dependencies: `npm install`
4. **Run** the demo: `npm run demo`
5. **Test** your changes with the example configs in `/config/`

## 🛠️ Development Workflow

### Making Changes

1. **Create a branch**: `git checkout -b feature/your-feature-name`
2. **Make your changes** with proper error handling and logging
3. **Test** thoroughly with different collection types and sizes
4. **Update documentation** if you change APIs or add features
5. **Submit a PR** with a clear description of your changes

### Code Standards

- **Error Handling**: All file operations must have proper try/catch blocks
- **Logging**: Use the `log()` function with appropriate levels (`info`, `warn`, `error`)
- **Documentation**: Add JSDoc comments for new functions
- **Testing**: Write tests for new merge logic (see GitHub Issues for test framework)

## 🧪 Testing Your Changes

### Manual Testing
```bash
# Test basic merge
npm run merge

# Test changelog generation  
npm run changelog

# Test with custom config
node scripts/merge.js --config path/to/your.config.yaml --working collections/test.json --refdir ref --out collections/test.merged.json
```

### Edge Cases to Test
- **Large collections** (1000+ requests)
- **Complex folder structures** (5+ levels deep)
- **Mixed auth types** (Basic, Bearer, API Key, etc.)
- **Special characters** in request names and descriptions
- **Malformed OpenAPI specs**
- **Empty collections**
- **Collections with custom variables**

## 📝 Commit Guidelines

- **Format**: `type(scope): description`
- **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- **Examples**:
  - `feat(merge): preserve custom headers during merge`
  - `fix(changelog): handle collections with no endpoints`
  - `docs(readme): add troubleshooting section`

## 🐛 Reporting Issues

### Bug Reports
- **Use the issue template**
- **Include sample files** (sanitized collections/specs)
- **Provide steps to reproduce**
- **Include error logs** (run with `DEBUG=1`)

### Feature Requests
- **Describe the use case** clearly
- **Explain why existing options don't work**
- **Provide examples** of desired behavior

## 💡 Feature Ideas

See our [GitHub Issues](https://github.com/postman-solutions-eng/oas-postman-merge/issues) for current feature requests. High-priority areas:

- **Testing Framework**: Comprehensive test suite
- **Visual Diff Tool**: Web-based collection comparison
- **Performance**: Large collection optimization
- **Config Validation**: Better error messages for invalid configs
- **Plugin System**: Support for custom merge strategies

## 🔍 Code Review Process

1. **Automated checks** must pass (linting, basic tests)
2. **Manual review** by maintainers
3. **Testing** with real-world collections
4. **Documentation** updates reviewed
5. **Merge** after approval

## 🆘 Getting Help

- **GitHub Discussions**: For questions and community help
- **Issues**: For bugs and feature requests  
- **Community**: Join the discussion for collaboration and support

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for helping make API tooling better for everyone!** 🙏


