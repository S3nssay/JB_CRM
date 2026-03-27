import React from 'react';
import AreaPageTemplate from '../AreaPageTemplate';

export default function WillesdenPage() {
  return (
    <AreaPageTemplate
      areaName="Willesden"
      postcode="NW10 & NW2"
      description="Your complete guide to property, lifestyle and investment in Willesden, NW10 & NW2 — updated September 2025."
      boroughContext="London Borough of Brent"
      councilTax="Brent Band D approx £2,133 (2025/26)"
      whyBuyersChoose="Look for streets near transport while avoiding main-road noise; check for residents' parking schemes."
      areaAtGlance="A practical, residential hub offering better value than neighbouring Queen's Park/West Hampstead, with steady family demand."
      areaAtGlanceDetails="High-street regeneration, diverse eateries, and accessible parks; strong community networks."
      propertyMarket="Flats to 3-bed terraces/semi-detached options; attractive step-up path for first-time buyers to family homes."
      transport="Jubilee (Willesden Green), Overground links via Willesden Junction, good bus coverage."
      schools={[
        "Gladstone Park Primary",
        "Menorah High (nearby)",
        "Capital City Academy"
      ]}
      lifestyle={[
        "Gladstone Park",
        "Local leisure centres",
        "Retail parks and supermarkets"
      ]}
      safetyInfo="Typical urban environment; choose residential streets set back from major arteries for quiet living."
      safetyTip="crime figures are borough-wide and can be skewed by busy commercial zones; quiet residential streets often experience far fewer incidents."
    />
  );
}