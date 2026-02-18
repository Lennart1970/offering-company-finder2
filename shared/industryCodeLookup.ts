/**
 * Industry Code Lookup
 * Static mappings for common SIC and NAICS codes to human-readable descriptions
 */

export const SIC_CODE_DESCRIPTIONS: Record<string, string> = {
  // Manufacturing - Electronics & Technology
  "3672": "Printed Circuit Boards",
  "3674": "Semiconductors and Related Devices",
  "3679": "Electronic Components, NEC",
  "3661": "Telephone and Telegraph Apparatus",
  "3663": "Radio and Television Broadcasting and Communications Equipment",
  "3669": "Communications Equipment, NEC",
  "3571": "Electronic Computers",
  "3572": "Computer Storage Devices",
  "3575": "Computer Terminals",
  "3577": "Computer Peripheral Equipment, NEC",
  "3578": "Calculating and Accounting Machines",
  
  // Manufacturing - Industrial Equipment
  "3523": "Farm Machinery and Equipment",
  "3524": "Lawn and Garden Tractors and Home Lawn and Garden Equipment",
  "3531": "Construction Machinery and Equipment",
  "3532": "Mining Machinery and Equipment",
  "3533": "Oil and Gas Field Machinery and Equipment",
  "3534": "Elevators and Moving Stairways",
  "3535": "Conveyors and Conveying Equipment",
  "3536": "Overhead Traveling Cranes, Hoists, and Monorail Systems",
  "3537": "Industrial Trucks, Tractors, Trailers, and Stackers",
  
  // Manufacturing - Automotive
  "3711": "Motor Vehicles and Passenger Car Bodies",
  "3713": "Truck and Bus Bodies",
  "3714": "Motor Vehicle Parts and Accessories",
  "3715": "Truck Trailers",
  "3716": "Motor Homes",
  
  // Manufacturing - Aerospace
  "3721": "Aircraft",
  "3724": "Aircraft Engines and Engine Parts",
  "3728": "Aircraft Parts and Auxiliary Equipment, NEC",
  
  // Manufacturing - Instruments
  "3823": "Industrial Instruments for Measurement, Display, and Control",
  "3824": "Totalizing Fluid Meters and Counting Devices",
  "3825": "Instruments for Measuring and Testing of Electricity",
  "3826": "Laboratory Analytical Instruments",
  "3827": "Optical Instruments and Lenses",
  "3829": "Measuring and Controlling Devices, NEC",
  
  // Mining & Extraction
  "1000": "Metal Mining",
  "1090": "Miscellaneous Metal Ores",
  "1220": "Bituminous Coal and Lignite Surface Mining",
  
  // Construction
  "1521": "General Contractors-Single-Family Houses",
  "1542": "General Contractors-Nonresidential Buildings",
  "1629": "Heavy Construction, Not Elsewhere Classified",
  "1742": "Plastering, Drywall, Acoustical, and Insulation Work",
  
  // Food & Kindred Products
  "2041": "Flour and Other Grain Mill Products",
  
  // Chemicals & Allied Products
  "2834": "Pharmaceutical Preparations",
  "2841": "Soaps and Other Detergents",
  "2869": "Industrial Organic Chemicals, NEC",
  
  // Rubber & Plastics
  "3011": "Tires and Inner Tubes",
  "3081": "Unsupported Plastics Film and Sheet",
  
  // Primary Metal Industries
  "3317": "Steel Pipe and Tubes",
  "3334": "Primary Production of Aluminum",
  
  // Fabricated Metal Products
  "3441": "Fabricated Structural Metal",
  "3494": "Valves and Pipe Fittings, NEC",
  
  // Industrial Machinery & Equipment (Additional)
  "3559": "Special Industry Machinery, NEC",
  "3569": "General Industrial Machinery and Equipment, NEC",
  "3581": "Automatic Vending Machines",
  "3589": "Service Industry Machinery, NEC",
  
  // Electronic & Electrical Equipment (Additional)
  "3621": "Motors and Generators",
  "3631": "Household Cooking Equipment",
  "3641": "Electric Lamp Bulbs and Tubes",
  "3699": "Electrical Machinery, Equipment, and Supplies, NEC",
  
  // Medical Instruments
  "3841": "Surgical and Medical Instruments and Apparatus",
  "3845": "Electromedical and Electrotherapeutic Apparatus",
  
  // Miscellaneous Manufacturing
  "3999": "Manufacturing Industries, NEC",
  
  // Transportation & Utilities
  "4011": "Railroads, Line-Haul Operating",
  "4111": "Local and Suburban Transit",
  "4412": "Deep Sea Foreign Transportation of Freight",
  "4499": "Water Transportation Services, NEC",
  "4731": "Arrangement of Transportation of Freight and Cargo",
  "4899": "Communications Services, NEC",
  "4911": "Electric Services",
  
  // Wholesale Trade
  "5099": "Durable Goods, NEC",
  
  // Food Service
  "5812": "Eating Places",
  "5813": "Drinking Places (Alcoholic Beverages)",
  
  // Finance & Insurance
  "6099": "Functions Related to Depository Banking, NEC",
  "6199": "Finance Services",
  "6712": "Offices of Bank Holding Companies",
  "6732": "Educational, Religious, and Charitable Trusts",
  
  // Business Services
  "7322": "Adjustment and Collection Services",
  "7359": "Equipment Rental and Leasing, NEC",
  "7361": "Employment Agencies",
  "7389": "Business Services, NEC",
  
  // Health Services
  "8011": "Offices and Clinics of Doctors of Medicine",
  "8062": "General Medical and Surgical Hospitals",
  "8099": "Health and Allied Services, NEC",
  
  // Legal, Educational & Social Services
  "8111": "Legal Services",
  "8221": "Colleges, Universities, and Professional Schools",
  "8222": "Junior Colleges and Technical Institutes",
  "8299": "Schools and Educational Services, NEC",
  "8399": "Social Services, NEC",
  
  // Engineering & Research Services
  "8731": "Commercial Physical and Biological Research",
  "8734": "Testing Laboratories",
  "8742": "Management Consulting Services",
  "8748": "Business Consulting Services, NEC",
  
  // Wholesale Trade
  "5065": "Electronic Parts and Equipment, NEC",
  "5084": "Industrial Machinery and Equipment",
  
  // Services
  "7371": "Computer Programming Services",
  "7372": "Prepackaged Software",
  "7373": "Computer Integrated Systems Design",
  "7374": "Computer Processing and Data Preparation",
  "7375": "Information Retrieval Services",
  "7376": "Computer Facilities Management Services",
  "7377": "Computer Rental and Leasing",
  "7378": "Computer Maintenance and Repair",
  "7379": "Computer Related Services, NEC",
  
  // Engineering Services
  "8711": "Engineering Services",
  "8712": "Architectural Services",
  "8713": "Surveying Services",
};

export const NAICS_CODE_DESCRIPTIONS: Record<string, string> = {
  // Manufacturing - Electronics & Computer Equipment
  "334111": "Electronic Computer Manufacturing",
  "334112": "Computer Storage Device Manufacturing",
  "334118": "Computer Terminal and Other Computer Peripheral Equipment Manufacturing",
  "334210": "Telephone Apparatus Manufacturing",
  "334220": "Radio and Television Broadcasting and Wireless Communications Equipment Manufacturing",
  "334290": "Other Communications Equipment Manufacturing",
  "334310": "Audio and Video Equipment Manufacturing",
  "334412": "Bare Printed Circuit Board Manufacturing",
  "334413": "Semiconductor and Related Device Manufacturing",
  "334414": "Electronic Capacitor Manufacturing",
  "334415": "Electronic Resistor Manufacturing",
  "334416": "Electronic Coil, Transformer, and Other Inductor Manufacturing",
  "334417": "Electronic Connector Manufacturing",
  "334418": "Printed Circuit Assembly (Electronic Assembly) Manufacturing",
  "334419": "Other Electronic Component Manufacturing",
  
  // Manufacturing - Industrial Machinery
  "333111": "Farm Machinery and Equipment Manufacturing",
  "333112": "Lawn and Garden Tractor and Home Lawn and Garden Equipment Manufacturing",
  "333120": "Construction Machinery Manufacturing",
  "333131": "Mining Machinery and Equipment Manufacturing",
  "333132": "Oil and Gas Field Machinery and Equipment Manufacturing",
  
  // Manufacturing - Automotive
  "336111": "Automobile Manufacturing",
  "336112": "Light Truck and Utility Vehicle Manufacturing",
  "336120": "Heavy Duty Truck Manufacturing",
  "336211": "Motor Vehicle Body Manufacturing",
  "336212": "Truck Trailer Manufacturing",
  "336213": "Motor Home Manufacturing",
  "336310": "Motor Vehicle Gasoline Engine and Engine Parts Manufacturing",
  "336320": "Motor Vehicle Electrical and Electronic Equipment Manufacturing",
  "336330": "Motor Vehicle Steering and Suspension Components (except Spring) Manufacturing",
  "336340": "Motor Vehicle Brake System Manufacturing",
  "336350": "Motor Vehicle Transmission and Power Train Parts Manufacturing",
  "336360": "Motor Vehicle Seating and Interior Trim Manufacturing",
  "336370": "Motor Vehicle Metal Stamping",
  "336390": "Other Motor Vehicle Parts Manufacturing",
  
  // Manufacturing - Aerospace
  "336411": "Aircraft Manufacturing",
  "336412": "Aircraft Engine and Engine Parts Manufacturing",
  "336413": "Other Aircraft Parts and Auxiliary Equipment Manufacturing",
  
  // Manufacturing - Instruments & Measuring Devices
  "334510": "Electromedical and Electrotherapeutic Apparatus Manufacturing",
  "334511": "Search, Detection, Navigation, Guidance, Aeronautical, and Nautical System and Instrument Manufacturing",
  "334512": "Automatic Environmental Control Manufacturing for Residential, Commercial, and Appliance Use",
  "334513": "Instruments and Related Products Manufacturing for Measuring, Displaying, and Controlling Industrial Process Variables",
  "334514": "Totalizing Fluid Meter and Counting Device Manufacturing",
  "334515": "Instrument Manufacturing for Measuring and Testing Electricity and Electrical Signals",
  "334516": "Analytical Laboratory Instrument Manufacturing",
  "334517": "Irradiation Apparatus Manufacturing",
  
  // Food Services
  "722511": "Full-Service Restaurants",
  "722513": "Limited-Service Restaurants",
  "722514": "Cafeterias, Grill Buffets, and Buffets",
  "722515": "Snack and Nonalcoholic Beverage Bars",
  
  // Wholesale Trade
  "423430": "Computer and Computer Peripheral Equipment and Software Merchant Wholesalers",
  "423690": "Other Electronic Parts and Equipment Merchant Wholesalers",
  "423830": "Industrial Machinery and Equipment Merchant Wholesalers",
  
  // Professional Services
  "541330": "Engineering Services",
  "541310": "Architectural Services",
  "541360": "Geophysical Surveying and Mapping Services",
  "541370": "Surveying and Mapping (except Geophysical) Services",
  "541511": "Custom Computer Programming Services",
  "541512": "Computer Systems Design Services",
  "541513": "Computer Facilities Management Services",
  "541519": "Other Computer Related Services",
};

/**
 * Get description for a SIC code
 */
export function getSicDescription(code: string): string | null {
  return SIC_CODE_DESCRIPTIONS[code] || null;
}

/**
 * Get description for a NAICS code
 */
export function getNaicsDescription(code: string): string | null {
  return NAICS_CODE_DESCRIPTIONS[code] || null;
}

/**
 * Get descriptions for multiple SIC codes
 */
export function getSicDescriptions(codes: string[]): Array<{ code: string; description: string | null }> {
  return codes.map(code => ({
    code,
    description: getSicDescription(code)
  }));
}

/**
 * Get descriptions for multiple NAICS codes
 */
export function getNaicsDescriptions(codes: string[]): Array<{ code: string; description: string | null }> {
  return codes.map(code => ({
    code,
    description: getNaicsDescription(code)
  }));
}
