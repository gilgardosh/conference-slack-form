/**
 * Sanitize company name according to Slack channel naming rules
 * TODO: Implement full sanitization logic
 */
export function sanitizeCompanyName(companyName: string): string {
  // Placeholder implementation - will be expanded in Milestone 2
  return companyName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 67);
}

/**
 * Check if email domain is a free email provider
 * TODO: Implement comprehensive free email domain check
 */
export function isFreeEmailDomain(email: string): boolean {
  // Placeholder implementation - will be expanded in Milestone 2
  const domain = email.split('@')[1];
  const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  return freeProviders.includes(domain?.toLowerCase() ?? '');
}
