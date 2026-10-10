import { PUBLIC_SITE_URL } from '../services/api'
const siteUrl = PUBLIC_SITE_URL || window.location.origin

const informationPages = {
  '/about': {
    title: 'About Us | NextStoryPart',
    description: 'Learn about NextStoryPart, an online story-reading website for readers who love fiction.',
    heading: 'About Us',
    content: (
      <>
        <p>Welcome to NextStoryPart - a place for readers who love stories.</p>
        <p>NextStoryPart is an online story-reading website featuring fictional stories across genres such as romance, drama, mystery, western romance, family stories, and short fiction.</p>
        <p>Our goal is simple: to make interesting stories easy to discover and enjoyable to read.</p>
        <p>We are continuously improving the website, organizing our content, and creating a better reading experience for our visitors.</p>
        <p>Thank you for visiting NextStoryPart and being part of our growing community of readers.</p>
        <p><strong>NextStoryPart Team</strong><br />Website: {siteUrl}</p>
      </>
    ),
  },
  '/contact': {
    title: 'Contact Us | NextStoryPart',
    description: 'Contact NextStoryPart with questions, feedback, suggestions, or copyright concerns.',
    heading: 'Contact Us',
    content: (
      <>
        <p>Have a question, suggestion, or concern? We&apos;d love to hear from you.</p>
        <h2>General Questions</h2>
        <p>For questions about NextStoryPart, stories, or website features:</p>
        <p>Email: Contact details will be added before launch.</p>
        <h2>Copyright Concerns</h2>
        <p>If you believe that content on NextStoryPart infringes your copyright, please contact us with:</p>
        <ul>
          <li>The URL of the content</li>
          <li>A description of the issue</li>
          <li>Information confirming your rights</li>
          <li>Your contact information</li>
        </ul>
        <p>We will review legitimate requests and take appropriate action.</p>
        <h2>Feedback</h2>
        <p>We also welcome suggestions about our stories, website design, reading experience, and future features.</p>
        <p><strong>NextStoryPart</strong><br />Website: {siteUrl}<br />Email: Contact details will be added before launch.</p>
      </>
    ),
  },
  '/privacy-policy': {
    title: 'Privacy Policy | NextStoryPart',
    description: 'Read the NextStoryPart privacy policy and learn how website information is collected and used.',
    heading: 'Privacy Policy',
    updated: 'Last Updated: September 8, 2026',
    content: (
      <>
        <p>NextStoryPart respects your privacy. This Privacy Policy explains how we collect and use information when you visit {siteUrl}.</p>
        <h2>Information We Collect</h2>
        <p>We may automatically collect basic information such as IP address, browser type, device information, pages visited, and website usage data.</p>
        <p>If you contact us, we may receive your name, email address, and other information you voluntarily provide.</p>
        <h2>How We Use Information</h2>
        <ul><li>Operate and improve our website</li><li>Understand website traffic and usage</li><li>Respond to inquiries</li><li>Maintain website security</li><li>Prevent abuse and spam</li><li>Display and measure relevant advertising</li></ul>
        <h2>Cookies &amp; Advertising</h2>
        <p>NextStoryPart may use cookies and third-party services such as analytics and advertising providers. These services may use cookies to measure traffic or display relevant advertisements.</p>
        <p>You can manage or disable cookies through your browser settings.</p>
        <h2>Third-Party Links</h2>
        <p>Our website may contain links to third-party websites. We are not responsible for their content or privacy practices.</p>
        <h2>Changes</h2>
        <p>We may update this Privacy Policy when necessary. Changes will be posted on this page.</p>
        <h2>Contact</h2>
        <p>Email: Contact details will be added before launch.</p>
      </>
    ),
  },
  '/terms-of-service': {
    title: 'Terms of Service | NextStoryPart',
    description: 'Read the NextStoryPart terms of service for using our online story-reading website.',
    heading: 'Terms of Service',
    updated: 'Last Updated: September 8, 2026',
    content: (
      <>
        <p>By accessing {siteUrl}, you agree to these Terms of Service.</p>
        <h2>Website Use</h2>
        <p>NextStoryPart provides online fictional stories and related literary content for readers.</p>
        <p>You agree not to:</p>
        <ul><li>Use the website for illegal purposes</li><li>Attempt to damage or disrupt the website</li><li>Access systems without authorization</li><li>Upload malicious content</li><li>Copy or redistribute protected content without permission</li></ul>
        <h2>Content &amp; Copyright</h2>
        <p>Stories, images, designs, logos, and other materials may be protected by copyright or other intellectual property rights.</p>
        <p>If you believe content on our website infringes your copyright, please contact us with the relevant URL and information about your rights.</p>
        <h2>Third-Party Links &amp; Advertising</h2>
        <p>NextStoryPart may contain third-party links and advertisements. We are not responsible for third-party websites, products, services, or content.</p>
        <h2>Website Availability</h2>
        <p>We try to keep the website available and accurate, but we do not guarantee that the website will always be uninterrupted or error-free.</p>
        <h2>Changes</h2>
        <p>We may update these Terms from time to time. Continued use of the website after changes are posted means you accept the updated Terms.</p>
        <h2>Contact</h2>
        <p>Email: Contact details will be added before launch.</p>
      </>
    ),
  },
}

function InformationPage({ page }) {
  return (
    <main className="information-main">
      <article className="information-card">
        <header className="information-header">
          <h1>{page.heading}</h1>
          {page.updated && <p className="information-updated">{page.updated}</p>}
        </header>
        <div className="information-content">{page.content}</div>
      </article>
    </main>
  )
}

export { informationPages, InformationPage }
