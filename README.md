# EBHCS Advisor Bulletin Board

A simple, user-friendly bulletin board system for East Boston Harborside Community School advisors to post job opportunities, training announcements, and resources for ESOL students.

## Features

- **Public Bulletin Display**: Clean, mobile-responsive display of all active bulletins
- **Simple Admin Interface**: Easy-to-use forms for advisors to post bulletins
- **Multi-Category Support**: Job opportunities, training, announcements, and resources
- **Deadline Tracking**: Automatic highlighting of approaching deadlines
- **User Management**: Multiple advisor accounts with simple authentication
- **Data Persistence**: All data stored locally in browser storage

## Quick Start

1. Open `index.html` in a web browser
2. Click "Advisor Login" to access the admin panel
3. Use default credentials: `admin` / `advisor123`

## Default Login Credentials

- **admin** / **advisor123** (Administrator)
- **marlie** / **teacher123** (Marlie Creed)
- **advisor1** / **ebhcs2024** (School Advisor)

## How Advisors Use the System

### For Advisors (Non-Technical Users):

1. **Accessing the System**:
   - Go to the website URL
   - Click "Advisor Login" button
   - Enter your username and password

2. **Creating a New Post**:
   - After logging in, you'll see the "New Post" tab
   - Fill out the form with:
     - **Title**: Brief, descriptive title
     - **Category**: Select job, training, announcement, or resource
     - **Description**: Detailed information about the opportunity
     - **Company/Organization**: (optional) Name of the organization
     - **Contact**: How students can apply or get more info
     - **Deadline**: (optional) Application or registration deadline
     - **Posted by**: Your name (auto-filled)
   - Click "Post Bulletin"

3. **Managing Your Posts**:
   - Click the "Manage Posts" tab
   - View all your active posts
   - Delete posts that are no longer relevant

## Technical Maintenance (For You)

### Adding New Users
Open the browser console and run:
```javascript
// This would need to be added to the validCredentials array in script.js
```

Or edit `script.js` line 45 to add new credentials to the `validCredentials` array:
```javascript
{ username: 'newuser', password: 'password123', name: 'Full Name' }
```

### Data Management
The system includes built-in data management tools accessible via browser console:

```javascript
// Export all bulletin data
bulletinBoard.exportData();

// Import data from JSON file
bulletinBoard.importData(jsonString);

// View current data
console.log(bulletinBoard.bulletins);

// Clear all data (be careful!)
localStorage.removeItem('ebhcs_bulletins');
```

### Deployment Options

1. **GitHub Pages** (Recommended):
   - Push to a GitHub repository
   - Enable GitHub Pages in repository settings
   - Use custom domain if desired

2. **Web Hosting Service**:
   - Upload all files to any web hosting service
   - No server-side requirements needed

3. **School Network**:
   - Host on school's internal web server
   - Works entirely with static files

### Customization

- **Colors/Styling**: Edit `style.css`
- **Categories**: Modify the categories in `script.js` line ~280
- **Sample Data**: Edit the `getSampleData()` function in `script.js`
- **School Branding**: Update header text in `index.html`

### Security Notes

- Currently uses client-side authentication (suitable for trusted environments)
- For enhanced security, consider implementing server-side authentication
- Regular backups recommended using the export function

### Browser Support

- Works on all modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive design
- No internet connection required once loaded

## File Structure

```
advisor_bulletin/
├── index.html          # Main page
├── style.css          # Styling
├── script.js          # Functionality
└── README.md          # This file
```

## Troubleshooting

**Problem**: Login not working
- **Solution**: Check credentials are typed correctly, case-sensitive

**Problem**: Posts not saving
- **Solution**: Ensure browser allows local storage, try different browser

**Problem**: Layout broken on mobile
- **Solution**: Clear browser cache and reload

**Problem**: Need to reset everything
- **Solution**: Open browser console, run: `localStorage.clear()` and reload

## Future Enhancements (Optional)

- Email notifications for new posts
- Image upload support
- Search/filter functionality
- Categories customization interface
- User role management
- Automatic post expiration