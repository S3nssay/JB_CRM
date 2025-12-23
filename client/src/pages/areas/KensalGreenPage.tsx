import React from 'react';
import AreaPageTemplate from '../AreaPageTemplate';

export default function KensalGreenPage() {
  return (
    <AreaPageTemplate
      areaName="Kensal Green"
      postcode="NW10"
      description="Your complete guide to property, lifestyle and investment in Kensal Green, NW10 — updated September 2025."
      boroughContext="London Borough of Brent (RBKC border)"
      councilTax="Brent Band D approx £2,133 (2025/26)"
      whyBuyersChoose="Check school catchments and borough boundary for council tax differences and admissions."
      areaAtGlance="Victorian terraces and calm, residential streets anchored by the historic Kensal Green Cemetery and canal paths."
      areaAtGlanceDetails="Relaxed cafés, neighbourhood pubs and weekend walks along the Grand Union; quick access to Portobello."
      propertyMarket="Family houses and period flats are in demand; premiums closest to Kensal Rise/Salusbury amenities."
      transport="Bakerloo & Overground at Kensal Green; Overground at Kensal Rise; bus to Notting Hill/Holland Park."
      schools={[
        "Princess Frederica CofE Primary",
        "Queens Park Community School",
        "Local nurseries"
      ]}
      lifestyle={[
        "Kensal Green Cemetery (green space)",
        "Local cafés",
        "Canal towpath"
      ]}
      safetyInfo="Generally quiet residential feel; main roads busier at peak hours."
      safetyTip="crime figures are borough-wide and can be skewed by busy commercial zones; quiet residential streets often experience far fewer incidents."
    />
  );
}