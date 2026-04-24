# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Enterprise-level project structure with `src/` layout
- Comprehensive test suite with unit and integration tests
- CI/CD pipeline with GitHub Actions
- Modern Python packaging with `pyproject.toml`
- Data separation with `data/raw/` and `data/processed/` directories
- Automated development setup script

### Changed
- Migrated from `requirements.txt` to `pyproject.toml` for dependency management
- Restructured codebase to follow enterprise best practices
- Improved configuration management with Pydantic settings

### Security
- Added security scanning with Bandit
- Dependency vulnerability checking with Safety
- Secure credential management

---

## [4.3.0] - 2026-04-23

### Added
- Multi-platform support (Tmall, Taobao, Amazon)
- Advanced data extraction with BeautifulSoup and Selenium
- Notion integration for data storage
- Real-time mutation observer for dynamic content
- Comprehensive logging system
- Rate limiting and concurrent request management
- Chrome extension with popup and sidepanel interfaces
- Backend server with Node.js/Express
- Python receptor for data processing

### Changed
- Complete rewrite of scraping engine
- Improved error handling and retry mechanisms
- Enhanced data validation and normalization
- Better performance with async operations

### Fixed
- Memory leaks in long-running scraping sessions
- Race conditions in concurrent data extraction
- CSS selector reliability issues
- Browser automation stability problems

### Security
- Input sanitization for all extracted data
- Secure API key management
- HTTPS enforcement for all communications
- XSS protection in web interfaces

---

## [4.2.0] - 2026-03-15

### Added
- Tmall-specific parser improvements
- Enhanced image extraction capabilities
- Stock availability detection
- Seller information extraction

### Changed
- Optimized CSS selectors for better reliability
- Improved data cleaning algorithms
- Enhanced error reporting

### Fixed
- Broken selectors after Tmall layout changes
- Price extraction for discounted items
- Category path parsing issues

---

## [4.1.0] - 2026-02-28

### Added
- Initial Chrome extension framework
- Basic web scraping functionality
- Simple data extraction for product pages
- Configuration file support

### Changed
- Migrated from standalone scripts to extension architecture
- Improved user interface with popup

### Fixed
- Basic stability issues
- Memory management improvements

---

## [4.0.0] - 2026-01-10

### Added
- Complete project rewrite
- Modern Python codebase
- Web scraping infrastructure
- Basic data storage capabilities

### Changed
- Breaking changes in API design
- New configuration system
- Improved error handling

### Deprecated
- Legacy Python 2.7 support
- Old scraping methods

### Removed
- Deprecated parsing functions
- Legacy configuration options

---

## [3.x.x] - Legacy Versions

### [3.2.1] - 2025-12-01
### [3.2.0] - 2025-11-15
### [3.1.0] - 2025-10-20
### [3.0.0] - 2025-09-01

*Legacy versions with basic scraping functionality*

---

## Version History Summary

- **v4.3.0** (2026-04-23): Enterprise structure and CI/CD
- **v4.2.0** (2026-03-15): Multi-platform enhancements
- **v4.1.0** (2026-02-28): Chrome extension integration
- **v4.0.0** (2026-01-10): Complete rewrite
- **v3.x.x** (2025): Legacy versions

---

## Migration Guide

### From v4.2 to v4.3
1. Update development environment with `scripts/setup_dev.sh`
2. Migrate configuration to use `pyproject.toml`
3. Update import paths for new `src/` structure
4. Run tests to verify compatibility

### From v4.1 to v4.2
1. Update parser configurations
2. Migrate to new data storage format
3. Update API endpoints for new features

### From v4.0 to v4.1
1. Install Chrome extension
2. Configure popup interface
3. Update scraping workflows

---

## Support

For questions about upgrading or reporting issues related to these changes:
- Check the [documentation](docs/context/context_v4_3.md)
- Review [test cases](tests/)
- Open an issue on GitHub

---

**Note:** This changelog follows the [Keep a Changelog](https://keepachangelog.com/) format and [Semantic Versioning](https://semver.org/).
