import React from 'react';
import AreaPageTemplate from '../AreaPageTemplate';

export default function BayswaterPage() {
  return (
    <AreaPageTemplate
      areaName="Bayswater"
      postcode="W2"
      description="Your complete guide to property, lifestyle and investment in Bayswater, W2 — updated September 2025."
      boroughContext="City of Westminster (Hyde Park/Queensway/Paddington borders)"
      councilTax="Westminster Band D approx £1,017 (2025/26)"
      whyBuyersChoose="Low Westminster council tax helps overall running costs. Look for quiet streets around Leinster Square and Cleveland Square for period charm without Hyde Park premiums."
      areaAtGlance="Bordering Hyde Park and Kensington Gardens, Bayswater blends cosmopolitan energy with elegant stucco terraces and mansion blocks. Garden squares and mews streets create a leafy, residential feel just minutes from the West End."
      areaAtGlanceDetails="Expect an international food scene on Queensway and Westbourne Grove, everyday convenience at Waitrose/Marks & Spencer, and a wave of new amenities from the Whiteleys redevelopment. Weekend life revolves around park walks, brunch spots, and boutique shopping."
      propertyMarket="Typical stock includes period conversions (1–3 beds), classic mansion-block apartments, and occasionally mews houses. Demand is steady from professionals and international buyers; corporate lets near Paddington are resilient. Service charges vary by block—check reserve funds."
      transport="Central/Circle/District at Queensway & Bayswater, Elizabeth/Bakerloo/National Rail at Paddington including Heathrow Express (~15 mins). Good bus and cycling access into the West End and City."
      schools={[
        "Hallfield Primary (state)",
        "Wetherby Preparatory (independent)", 
        "City of Westminster College (FE)"
      ]}
      lifestyle={[
        "Hyde Park & Kensington Gardens",
        "Westbourne Grove boutiques",
        "Whiteleys retail redevelopment",
        "Local gyms and studios"
      ]}
      safetyInfo="Westminster's headline crime rate is elevated by West End nightlife; Bayswater's residential squares are notably calmer with active residents' associations and Neighbourhood Watch groups."
      safetyTip="crime figures are borough-wide and can be skewed by busy commercial zones; quiet residential streets often experience far fewer incidents."
    />
  );
}