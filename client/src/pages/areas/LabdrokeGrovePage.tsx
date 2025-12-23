import React from 'react';
import AreaPageTemplate from '../AreaPageTemplate';

export default function LabdrokeGrovePage() {
  return (
    <AreaPageTemplate
      areaName="Ladbroke Grove"
      postcode="W10"
      description="Your complete guide to property, lifestyle and investment in Ladbroke Grove, W10 — updated September 2025."
      boroughContext="Royal Borough of Kensington & Chelsea"
      councilTax="Kensington & Chelsea Band D approx £1,569 (2025/26)"
      whyBuyersChoose="Look for well-managed conversions; soundproofing and service charges can vary widely."
      areaAtGlance="Bohemian Notting Hill character with classic stucco crescents and colourful terraces; a long-time favourite of creatives."
      areaAtGlanceDetails="Antiques hunting on Portobello, brunch on Golborne Road, and quick trips to Westfield White City for bigger retail."
      propertyMarket="Strong demand for period flats and mews; family houses fetch premiums on garden squares."
      transport="Circle & Hammersmith & City at Ladbroke Grove and Latimer Road."
      schools={[
        "Thomas Jones Primary",
        "Bales College (independent)",
        "Nearby Notting Hill & Ealing options"
      ]}
      lifestyle={[
        "Portobello & Golborne markets",
        "Holland Park (nearby)",
        "Boutique fitness studios"
      ]}
      safetyInfo="K&C's crime rate is below central-London hotspots; lively on market days—seek quieter side streets for tranquillity."
      safetyTip="crime figures are borough-wide and can be skewed by busy commercial zones; quiet residential streets often experience far fewer incidents."
    />
  );
}