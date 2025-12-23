import React from 'react';
import AreaPageTemplate from '../AreaPageTemplate';

export default function QueensParkPage() {
  return (
    <AreaPageTemplate
      areaName="Queen's Park"
      postcode="NW6"
      description="Your complete guide to property, lifestyle and investment in Queen's Park, NW6 — updated September 2025."
      boroughContext="Split between Westminster (south) and Brent (north)"
      councilTax="Westminster Band D ~£1,017; Brent Band D ~£2,133 (2025/26)"
      whyBuyersChoose="Borough boundary affects council tax and admissions — confirm address details before offering."
      areaAtGlance="A village atmosphere centred on the park and Salusbury Road, prized by young families and professionals."
      areaAtGlanceDetails="Farmers' markets, independent cafés, and playgrounds make weekends easy; quick links to the West End."
      propertyMarket="Victorian terraces and conversions; premiums on streets closest to the park; apartments offer entry points."
      transport="Bakerloo/Overground at Queen's Park; Thameslink/Overground options nearby at Brondesbury/West Hampstead."
      schools={[
        "Malorees Infant & Junior",
        "Ark Franklin Primary",
        "Independent preps in NW6/W9"
      ]}
      lifestyle={[
        "Queen's Park itself",
        "Salusbury Road cafés and shops",
        "Community sports facilities"
      ]}
      safetyInfo="Residential and family-oriented; standard vigilance around stations/high street."
      safetyTip="crime figures are borough-wide and can be skewed by busy commercial zones; quiet residential streets often experience far fewer incidents."
    />
  );
}