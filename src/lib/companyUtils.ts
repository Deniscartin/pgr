/**
 * Utility functions for company name processing
 */

const VALID_COMPANIES = [
  'petrolis',
  'geavis', 
  'petrol umbra',
  'romabitumi',
  'roma bitumi'
];

/**
 * Checks if a company name contains any of the valid company names
 * @param companyName - The company name from document extraction
 * @returns The display name: original company name if valid, 'DIRETTA' otherwise
 */
export function getDisplayCompanyName(companyName: string | undefined | null): string {
  if (!companyName) {
    return 'DIRETTA';
  }

  const lowerCompanyName = companyName.toLowerCase();
  
  const hasValidCompany = VALID_COMPANIES.some(validCompany => 
    lowerCompanyName.includes(validCompany.toLowerCase())
  );

  return hasValidCompany ? companyName : 'DIRETTA';
}

/**
 * Check if company name is valid (contains one of the specified companies)
 * @param companyName - The company name to check
 * @returns true if valid, false otherwise
 */
export function isValidCompany(companyName: string | undefined | null): boolean {
  if (!companyName) {
    return false;
  }

  const lowerCompanyName = companyName.toLowerCase();
  
  return VALID_COMPANIES.some(validCompany => 
    lowerCompanyName.includes(validCompany.toLowerCase())
  );
}