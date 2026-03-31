import jsPDF from 'jspdf';
import 'jspdf-autotable';

const generatePayslipPDF = (payslipData) => {
  const doc = new jsPDF();
  
  // Set font
  doc.setFont('helvetica');
  
  // Company Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Zoonodle Inc', 20, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('21023 Pearson Point Road', 20, 28);
  doc.text('Gate Avenue', 20, 35);
  
  // Employee Details
  const startY = 50;
  doc.setFontSize(10);
  
  // Left column details
  doc.text(`Date of Joining: ${payslipData.dateOfJoining}`, 20, startY);
  doc.text(`Pay Period: ${payslipData.payPeriod}`, 20, startY + 8);
  doc.text(`Worked Days: ${payslipData.workedDays}`, 20, startY + 16);
  
  // Right column details
  doc.text(`Employee Name: ${payslipData.employeeName}`, 120, startY);
  doc.text(`Designation: ${payslipData.designation}`, 120, startY + 8);
  doc.text(`Department: ${payslipData.department}`, 120, startY + 16);
  
  // Earnings and Deductions Table
  const tableStartY = startY + 35;
  
  // Table headers
  const headers = [
    ['Earnings', 'Amount', 'Deductions', 'Amount']
  ];
  
  // Table data
  const tableData = [
    ['Basic Pay', payslipData.earnings.basicPay.toString(), 'Provident Fund', payslipData.deductions.providentFund.toString()],
    ['Incentive Pay', payslipData.earnings.incentivePay.toString(), 'Professional Tax', payslipData.deductions.professionalTax.toString()],
    ['House Rent Allowance', payslipData.earnings.houseRentAllowance.toString(), 'Loan', payslipData.deductions.loan.toString()],
    ['Meal Allowance', payslipData.earnings.mealAllowance.toString(), '', ''],
    ['', '', '', ''],
    ['Total Earnings', payslipData.totalEarnings.toString(), 'Total Deductions', payslipData.totalDeductions.toString()],
    ['', '', 'Net Pay', payslipData.netPay.toString()]
  ];
  
  // Generate table
  doc.autoTable({
    head: headers,
    body: tableData,
    startY: tableStartY,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 5,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 25, halign: 'right' },
      2: { cellWidth: 45 },
      3: { cellWidth: 25, halign: 'right' }
    },
    didParseCell: function(data) {
      // Style total rows
      if (data.row.index === 5 || data.row.index === 6) {
        data.cell.styles.fontStyle = 'bold';
        if (data.row.index === 6 && (data.column.index === 2 || data.column.index === 3)) {
          data.cell.styles.fillColor = [220, 220, 220];
        }
      }
    }
  });
  
  // Net pay amount in words
  const finalY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(payslipData.netPay.toString(), 20, finalY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(payslipData.netPayInWords, 20, finalY + 8);
  
  // Signatures
  const signatureY = finalY + 25;
  doc.text('Employer Signature', 20, signatureY);
  doc.text('Employee Signature', 120, signatureY);
  
  // Footer
  doc.setFontSize(8);
  doc.text('This is system generated payslip', 20, signatureY + 15);
  
  // Save the PDF
  doc.save(`payslip_${payslipData.employeeName.replace(/\s+/g, '_')}_${payslipData.payPeriod.replace(/\s+/g, '_')}.pdf`);
};

// Helper function to convert number to words (basic implementation)
const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const thousands = ['', 'Thousand', 'Million', 'Billion'];
  
  if (num === 0) return 'Zero';
  
  const convertGroup = (n) => {
    let result = '';
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    } else if (n >= 10) {
      result += teens[n - 10] + ' ';
      return result;
    }
    if (n > 0) {
      result += ones[n] + ' ';
    }
    return result;
  };
  
  let result = '';
  let groupIndex = 0;
  
  while (num > 0) {
    const group = num % 1000;
    if (group !== 0) {
      result = convertGroup(group) + thousands[groupIndex] + ' ' + result;
    }
    num = Math.floor(num / 1000);
    groupIndex++;
  }
  
  return result.trim();
};

// Usage example with your data structure:
const examplePayslipData = {
  dateOfJoining: '2018-06-23',
  payPeriod: 'August 2021',
  workedDays: 26,
  employeeName: 'Sally Harley',
  designation: 'Marketing Executive',
  department: 'Marketing',
  earnings: {
    basicPay: 10000,
    incentivePay: 1000,
    houseRentAllowance: 400,
    mealAllowance: 200
  },
  deductions: {
    providentFund: 1200,
    professionalTax: 500,
    loan: 400
  },
  totalEarnings: 11600,
  totalDeductions: 2100,
  netPay: 9500,
  netPayInWords: 'Nine Thousand Five Hundred'
};

// To use the function:
// generatePayslipPDF(examplePayslipData);

export { generatePayslipPDF, numberToWords };