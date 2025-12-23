import React from 'react';
import AreaPageTemplate from '../AreaPageTemplate';

export default function KensalRisePage() {
  return (
    <AreaPageTemplate
      areaName="Kensal Rise"
      postcode="NW10"
      description="Your complete guide to property, lifestyle and investment in Kensal Rise, NW10 — updated September 2025."
      boroughContext="London Borough of Brent (Queen's Park fringe)"
      councilTax="Brent Band D approx £2,133 (2025/26)"
      whyBuyersChoose="Chamberlayne Road proximity boosts convenience but side streets are quieter; check controlled parking zones."
      areaAtGlance="A sought-after village pocket north of Queen's Park with cafés along Chamberlayne Road and period streets."
      areaAtGlanceDetails="Brunch spots, independent retailers, and quick access to Queen's Park and Portobello."
      propertyMarket="Two- and three-bedroom terraces drive demand; conversions for first-time buyers remain active."
      transport="Overground at Kensal Rise; Bakerloo at Kensal Green within reach."
      schools={[
        "Ark Franklin Primary",
        "Queens Park Community School",
        "Independent preps nearby"
      ]}
      lifestyle={[
        "Salusbury Road/Queen's Park amenities",
        "Local yoga/fitness studios",
        "Neighbourhood pubs"
      ]}
      safetyInfo="Local community groups active; typical urban environment around stations/high street."
      safetyTip="crime figures are borough-wide and can be skewed by busy commercial zones; quiet residential streets often experience far fewer incidents."
    />
  );
}