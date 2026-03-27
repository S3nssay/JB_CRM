import React from 'react';
import AreaPageTemplate from '../AreaPageTemplate';

export default function NorthKensingtonPage() {
  return (
    <AreaPageTemplate
      areaName="North Kensington"
      postcode="W10"
      description="Your complete guide to property, lifestyle and investment in North Kensington, W10 — updated September 2025."
      boroughContext="Royal Borough of Kensington & Chelsea (north of Notting Hill)"
      councilTax="Kensington & Chelsea Band D approx £1,569 (2025/26)"
      whyBuyersChoose="Look for streets near green corridors and emerging café clusters for upside potential."
      areaAtGlance="A residential pocket with improving amenities and strong community feel, offering relative value compared with Notting Hill proper."
      areaAtGlanceDetails="Local cafés on St Helen's and Ladbroke Grove, with Portobello and Kensal scenes nearby."
      propertyMarket="Mix of period terraces, conversions and ex-local authority homes offering entry points into W10."
      transport="Latimer Road and Ladbroke Grove stations (Circle/H&C)."
      schools={[
        "Oxford Gardens Primary",
        "Ark Burlington Danes (nearby)",
        "Independent nurseries"
      ]}
      lifestyle={[
        "Little Wormwood Scrubs",
        "Local parks and play areas",
        "Community centres"
      ]}
      safetyInfo="Residential feel with community initiatives; busier near main roads and market areas."
      safetyTip="crime figures are borough-wide and can be skewed by busy commercial zones; quiet residential streets often experience far fewer incidents."
    />
  );
}