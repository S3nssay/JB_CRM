import React from 'react';
import AreaPageTemplate from '../AreaPageTemplate';

export default function WestbourneParkPage() {
  return (
    <AreaPageTemplate
      areaName="Westbourne Park"
      postcode="W10/W11"
      description="Your complete guide to property, lifestyle and investment in Westbourne Park, W10/W11 — updated September 2025."
      boroughContext="Westminster & Kensington and Chelsea (border location)"
      councilTax="Westminster Band D ~£1,017; K&C Band D ~£1,569 (2025/26)"
      whyBuyersChoose="Check which borough a property sits in: council tax and school admissions differ between Westminster and K&C."
      areaAtGlance="Creative, youthful and well-located, Westbourne Park sits between Bayswater and Notting Hill with easy access to Portobello Road."
      areaAtGlanceDetails="Weekend markets, artisan coffee, and pastel terraces define the local streetscape; the canal adds quiet walking routes."
      propertyMarket="Period conversions dominate with mews and boutique new-builds. Prices vary street-by-street depending on borough line and outlook."
      transport="Circle & Hammersmith & City at Westbourne Park; Paddington (Elizabeth Line) within reach."
      schools={[
        "Colville Primary",
        "Chepstow House School (independent)",
        "Academy schools across W11"
      ]}
      lifestyle={[
        "Portobello Road Market",
        "Local gyms and yoga studios",
        "Grand Union Canal paths"
      ]}
      safetyInfo="Generally residential; choose streets away from main market thoroughfares for quieter living."
      safetyTip="crime figures are borough-wide and can be skewed by busy commercial zones; quiet residential streets often experience far fewer incidents."
    />
  );
}