[![Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_a_Coffee-FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=000000)](https://www.buymeacoffee.com/laurentftech)

# KidSearch 🔍

A secure and educational search engine designed for children, using Google Custom Search Engine with filtered results and knowledge panels powered by Vikidia.

When combined with Google Family Link (or another whitelist system) on Chrome, you can restrict Internet access to child-friendly websites of your choice (and block direct access to google.com, for example).

## Features

- 🎯 **Filtered results**: Only approved educational websites appear
- 🔍 **Custom autocomplete**: 200+ educational suggestions with keyboard navigation
- 📚 **Recommended sites**: Curated selection of quality educational resources
- 🖼️ **Image search**: Image search mode with preview functionality
- 📖 **Knowledge panels**: Contextual information from Vikidia to enrich results
- 🔄 **Smart caching**: Intelligent caching system to optimize performance and save API quota
- 📊 **Quota management**: Automatic monitoring of Google API usage
- 🇫🇷🇬🇧 **Language prioritization**: Automatic detection of French or English queries for better results
- 🔧 **Sort options**: Sort by relevance or date (for web results)
- 📱 **Responsive design**: Works on desktop, tablet and mobile
- 🎨 **Child-friendly interface**: Colorful and user-friendly design with expressive icons

## Installation

1. **Clone the repository**:
   ```bash
   git clone [your-repo]
   cd search-for-kids
   ```

2. **Configuration**:
   ```bash
   cp config.example.js config.js
   ```

3. **Edit `config.js`** with your Google Custom Search Engine ID, Google API key and knowledge panels configuration:
   ```javascript
   const CONFIG = {
       GOOGLE_CSE_ID: 'your_cse_id_here',
       GOOGLE_API_KEY: 'YOUR_API_KEY_HERE',
       KNOWLEDGE_PANEL_CONFIG: {
           ENABLED: true,
           API_URL: 'https://fr.vikidia.org/w/api.php',
           BASE_URL: 'https://fr.vikidia.org/wiki/',
           SOURCE_NAME: 'Vikidia (Encyclopedia for 8-13 year olds)',
           EXTRACT_LENGTH: 300,
           THUMBNAIL_SIZE: 150,
           DISABLE_THUMBNAILS: false
       }
   };
   ```

4. **Start a local server**:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Or use Live Server in VS Code
   ```

5. **Navigate to**: `http://localhost:8000`

## Google CSE Configuration

1. Go to [Google Custom Search Engine](https://cse.google.com/)
2. Create a new search engine
3. Add your approved sites in "Sites to search"
4. Enable image search in settings
5. Get your CSE ID (format: `xxx:yyyyy`)
6. Get a Google API key from [Google Cloud Console](https://console.cloud.google.com)
7. Paste credentials in `config.js`

## File Structure

```
search-for-kids/
├── index.html              # Homepage with recommended sites
├── results.html            # Results page with web/images tabs
├── search.js              # Main search engine with cache and quota
├── knowledge-panels.js    # Vikidia knowledge panels
├── suggestions.json       # Autocomplete suggestions database
├── config.js             # Configuration (not committed)
├── config.example.js     # Configuration example
├── logo.png             # Search engine logo
├── favicon.png          # Site icon
└── README.md            # This file
```

## Advanced Features

### Caching System
- **Persistent cache**: Results are cached in localStorage for 7 days
- **Smart limits**: Maximum 300 cached queries for optimal performance
- **Auto-cleanup**: Automatic removal of expired entries

### API Quota Management
- **Daily monitoring**: Track API usage with 90 requests/day limit
- **Visual indicator**: Real-time display of remaining quota and cache status
- **Protection**: Prevents accidental exceeding of Google limits

### Knowledge Panels
- **Educational source**: Integration with Vikidia API for child-appropriate information
- **Smart search**: Tries multiple variants (singular/plural, case, accents)
- **Relevant filtering**: Only displays for appropriate educational queries

### Language Detection
- **French prioritization**: Automatic detection of French queries
- **Better results**: Apply `lang_fr` filter for more relevant results

## Customization

### Adding Suggestions
Edit `suggestions.json` to add your own search terms:

```json
{
  "suggestions": [
    "new term",
    "another suggestion",
    "dinosaurs",
    "solar system"
  ]
}
```

### Modifying Recommended Sites
In `index.html`, `.recommended-sites` section, add your own educational sites with icons.

### Knowledge Panel Configuration
Customize knowledge panels in `config.js`:
- `ENABLED`: Enable/disable the feature
- `EXTRACT_LENGTH`: Extract length (default: 300 characters)
- `DISABLE_THUMBNAILS`: Disable images if needed

## Technologies Used

- **Frontend**: HTML5/CSS3, JavaScript ES6+
- **APIs**: Google Custom Search Engine API, MediaWiki API (Vikidia)
- **Storage**: localStorage for cache and quota management
- **Design**: CSS Grid/Flexbox, responsive design
- **Features**: Autocomplete, image modal, pagination, sorting

## Security and Privacy

- ✅ All results are filtered by Google CSE
- ✅ Only pre-approved sites appear
- ✅ No personal data collection
- ✅ Local cache only (no third-party servers)
- ✅ Child-dedicated interface
- ✅ Verified educational sources (Vikidia)

## Usage

### Basic Search
1. Type your search in the search bar
2. Use autocomplete with ↑↓ arrows and Enter
3. Click 🔍 or press Enter

### Image Search
1. Perform a search
2. Click on the "Images" tab
3. Click on an image to enlarge it

### Sort Options (web results)
1. Click "Tools" under the search bar
2. Choose "Sort by date" for recent results
3. Or keep "Relevance" for best results

## Contribution

1. Fork the project
2. Create a branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## Troubleshooting

### Common Issues
- **No results**: Check your Google CSE configuration and API key
- **Quota exceeded**: Wait until tomorrow or check quota indicator
- **Images not loading**: Check that image search is enabled in Google CSE
- **Missing panels**: Check that `KNOWLEDGE_PANEL_CONFIG.ENABLED` is `true`

### Cache and Performance
- Cache automatically clears after 7 days
- To manually clear: open console and type `localStorage.clear()`
- Quota indicator appears at bottom right of results page

## License

This project is licensed under the MIT License. See the `LICENSE` file for more details.

---

**Created with ❤️ for children's education**
