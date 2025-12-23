import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TableHeader, TableRow, TableHead, TableBody, TableCell, Table } from "@/components/ui/table";
import { formatCurrency } from '@/lib/utils';

interface CostComparisonProps {
  marketValue: number;
  cashOfferValue: number;
}

const CostComparison: React.FC<CostComparisonProps> = ({ 
  marketValue = 300000,
  cashOfferValue = 255000
}) => {
  // Traditional selling costs
  const estateFeeRate = 0.015; // 1.5%
  const estateAgentFee = marketValue * estateFeeRate;
  const utilityBills = 2040; // 6 months of utility bills during selling period
  const councilTax = 1672; // 6 months of council tax during selling period
  const mortgageCosts = 2286; // 6 months of mortgage payments

  // Calculate final amounts
  const traditionalFinalAmount = marketValue - estateAgentFee - utilityBills - councilTax - mortgageCosts;
  const cashBuyersFinalAmount = cashOfferValue; // No deductions as we cover all costs

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3 text-left pl-4 py-4 text-primary text-lg font-medium">
                Cost Breakdown
              </TableHead>
              <TableHead className="w-1/3 text-center bg-gray-100 text-primary text-lg font-medium">
                Traditional Sale
              </TableHead>
              <TableHead className="w-1/3 text-center bg-primary-dark text-white text-lg font-medium">
                cashpropertybuyers.uk
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium pl-4 py-4 text-primary-dark">
                Original advertised price
              </TableCell>
              <TableCell className="text-center bg-gray-100 text-primary-dark font-medium">
                {formatCurrency(marketValue)}
              </TableCell>
              <TableCell className="text-center bg-primary-dark/10 text-primary-dark font-medium">
                N/A
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium pl-4 py-4 text-primary-dark">
                True market value
              </TableCell>
              <TableCell className="text-center bg-gray-100 text-primary-dark font-medium">
                {formatCurrency(marketValue)}
              </TableCell>
              <TableCell className="text-center bg-primary-dark/10 text-primary-dark font-medium">
                {formatCurrency(marketValue)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium pl-4 py-4 text-primary-dark">
                Agreed sale price
              </TableCell>
              <TableCell className="text-center bg-gray-100 text-primary-dark font-medium">
                {formatCurrency(marketValue * 0.94)} {/* 6% negotiation discount */}
              </TableCell>
              <TableCell className="text-center bg-primary-dark/10 text-primary-dark font-medium">
                {formatCurrency(cashOfferValue)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium pl-4 py-4 text-primary-dark">
                Price after agent fees
              </TableCell>
              <TableCell className="text-center bg-gray-100 text-primary-dark font-medium">
                {formatCurrency(marketValue * 0.94 - estateAgentFee)}
              </TableCell>
              <TableCell className="text-center bg-primary-dark/10 text-primary-dark font-medium">
                {formatCurrency(cashOfferValue)} {/* No agent fees */}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium pl-4 py-4 text-primary-dark">
                Price after utility bills
              </TableCell>
              <TableCell className="text-center bg-gray-100 text-primary-dark font-medium">
                {formatCurrency(marketValue * 0.94 - estateAgentFee - utilityBills)}
              </TableCell>
              <TableCell className="text-center bg-primary-dark/10 text-primary-dark font-medium">
                {formatCurrency(cashOfferValue)} {/* No utility costs */}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium pl-4 py-4 text-primary-dark">
                Price after council tax
              </TableCell>
              <TableCell className="text-center bg-gray-100 text-primary-dark font-medium">
                {formatCurrency(marketValue * 0.94 - estateAgentFee - utilityBills - councilTax)}
              </TableCell>
              <TableCell className="text-center bg-primary-dark/10 text-primary-dark font-medium">
                {formatCurrency(cashOfferValue)} {/* No council tax */}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium pl-4 py-4 text-primary-dark">
                Price after mortgage costs
              </TableCell>
              <TableCell className="text-center bg-gray-100 text-primary-dark font-medium">
                {formatCurrency(traditionalFinalAmount)}
              </TableCell>
              <TableCell className="text-center bg-primary-dark/10 text-primary-dark font-medium">
                {formatCurrency(cashOfferValue)} {/* No mortgage costs */}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium pl-4 py-4 text-xl text-primary-dark">
                Final amount you get
              </TableCell>
              <TableCell className="text-center bg-gray-100 text-xl text-primary-dark font-bold">
                {formatCurrency(traditionalFinalAmount)}
              </TableCell>
              <TableCell className="text-center bg-[#791E75] text-white 500 text-xl text-white font-bold">
                {formatCurrency(cashOfferValue)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default CostComparison;