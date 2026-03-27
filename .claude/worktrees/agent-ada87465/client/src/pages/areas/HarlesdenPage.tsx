import React from 'react';
import AreaPageTemplate from '../AreaPageTemplate';

export default function HarlesdenPage() {
  return (
    <AreaPageTemplate
      areaName="Harlesden"
      postcode="NW10"
      description="Your complete guide to property, lifestyle and investment in Harlesden, NW10 — updated September 2025."
      boroughContext="London Borough of Brent"
      councilTax="Brent Band D approx £2,133 (2025/26)"
      whyBuyersChoose="Streets near Roundwood Park are popular with families; check parking zones and upcoming high-street improvements."
      areaAtGlance="A lively, diverse neighbourhood known for its Caribbean and Lusophone heritage, strong transport links and improving town centre."
      areaAtGlanceDetails="Independent eateries, music culture, and access to green spaces via the canal and Roundwood Park."
      propertyMarket="Good-value Victorian terraces and conversions; investor interest for yields; regeneration is improving stock."
      transport="Bakerloo/Overground at Harlesden; Willesden Junction connects to Elizabeth line interchanges."
      schools={[
        "Capital City Academy",
        "Convent of Jesus & Mary Language College",
        "Primary schools rated Good"
      ]}
      lifestyle={[
        "Roundwood Park",
        "Local markets and cafés",
        "Grand Union Canal access"
      ]}
      safetyInfo="Brent's borough-wide crime rate is moderate for London; community policing and local initiatives active."
      safetyTip="crime figures are borough-wide and can be skewed by busy commercial zones; quiet residential streets often experience far fewer incidents."
    />
  );
}