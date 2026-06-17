import React from 'react';

function Privacy() {
    return (
        <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', lineHeight: '1.6', color: '#333' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>Privacy Policy</h1>
            <p><strong>Last updated:</strong> June 17, 2026</p>

            <h2 style={{ marginTop: '30px', fontSize: '1.5rem' }}>1. Introduction</h2>
            <p>Welcome to SearchTern. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights.</p>

            <h2 style={{ marginTop: '30px', fontSize: '1.5rem' }}>2. The data we collect about you</h2>
            <p>When you register and use SearchTern, we may collect, use, store and transfer different kinds of personal data about you, including:</p>
            <ul>
                <li><strong>Identity Data:</strong> includes your first name, last name, or username.</li>
                <li><strong>Contact Data:</strong> includes your email address.</li>
                <li><strong>Application Data:</strong> data related to the internships you track, notes you take, and statuses you update within the platform.</li>
            </ul>

            <h2 style={{ marginTop: '30px', fontSize: '1.5rem' }}>3. How we use your personal data</h2>
            <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data to provide you with the application tracking service, authenticate your login (including via Google), and sync your data across your devices.</p>

            <h2 style={{ marginTop: '30px', fontSize: '1.5rem' }}>4. Data Security</h2>
            <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way, altered, or disclosed. Your authentication and tracked jobs are securely stored using industry-standard database providers.</p>

            <h2 style={{ marginTop: '30px', fontSize: '1.5rem' }}>5. Third-party links</h2>
            <p>This website may include links to third-party websites (such as job postings). Clicking on those links may allow third parties to collect or share data about you. We do not control these third-party websites and are not responsible for their privacy statements.</p>

            <h2 style={{ marginTop: '30px', fontSize: '1.5rem' }}>6. Contact Us</h2>
            <p>If you have any questions about this privacy policy or our privacy practices, please contact us via the support email provided in our application.</p>
        </div>
    );
}

export default Privacy;
