/**
 * EA Form Service
 * Handles EA Form (PCB Form) generation for Malaysian tax purposes
 *
 * EA Form = Employer's Annual Return (Borang EA)
 * Required for employees to file income tax with LHDN (Lembaga Hasil Dalam Negeri)
 */

import { collection, query, where, getDocs, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

class EAFormService {
  /**
   * Calculate annual EA Form data for an employee
   * @param {string} employeeId - Employee user ID
   * @param {number} year - Tax year (e.g., 2024)
   * @returns {Object} EA Form data
   */
  async calculateEAFormData(employeeId, year) {
    try {
      console.log(`📊 Calculating EA Form for employee ${employeeId} for year ${year}`);

      // Get employee details
      const employeeDoc = await getDoc(doc(db, 'users', employeeId));
      if (!employeeDoc.exists()) {
        throw new Error('Employee not found');
      }
      const employee = { id: employeeDoc.id, ...employeeDoc.data() };

      // Get company details
      const companyName = employee.originalCompanyName || employee.company;
      const companiesQuery = query(collection(db, 'companies'), where('name', '==', companyName));
      const companiesSnapshot = await getDocs(companiesQuery);

      let company = null;
      if (!companiesSnapshot.empty) {
        company = { id: companiesSnapshot.docs[0].id, ...companiesSnapshot.docs[0].data() };
      }

      // Get all payslips for the year
      const startDate = `${year}-01`;
      const endDate = `${year}-12`;

      const payslipsQuery = query(
        collection(db, 'payslips'),
        where('employeeId', '==', employeeId),
        where('month', '>=', startDate),
        where('month', '<=', endDate)
      );

      const payslipsSnapshot = await getDocs(payslipsQuery);
      const payslips = payslipsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      console.log(`📋 Found ${payslips.length} payslips for ${year}`);

      // Calculate totals from payslips
      let totalBasicSalary = 0;
      let totalGrossSalary = 0;
      let totalEmployeeEPF = 0;
      let totalEmployerEPF = 0;
      let totalEmployeeSOCSO = 0;
      let totalEmployerSOCSO = 0;
      let totalEmployeeEIS = 0;
      let totalEmployerEIS = 0;
      let totalZakat = 0;
      let totalPCB = 0;
      let totalNetSalary = 0;

      payslips.forEach(payslip => {
        totalBasicSalary += parseFloat(payslip.basicSalary || 0);
        totalGrossSalary += parseFloat(payslip.grossSalary || 0);
        totalEmployeeEPF += parseFloat(payslip.employeeEPF || 0);
        totalEmployerEPF += parseFloat(payslip.employerEPF || 0);
        totalEmployeeSOCSO += parseFloat(payslip.employeeSOCSO || 0);
        totalEmployerSOCSO += parseFloat(payslip.employerSOCSO || 0);
        totalEmployeeEIS += parseFloat(payslip.employeeEIS || 0);
        totalEmployerEIS += parseFloat(payslip.employerEIS || 0);
        totalZakat += parseFloat(payslip.zakat || 0);
        totalPCB += parseFloat(payslip.mtdPCB || 0);
        totalNetSalary += parseFloat(payslip.netSalary || 0);
      });

      // Calculate total deductions
      const totalDeductions = totalEmployeeEPF + totalEmployeeSOCSO + totalEmployeeEIS + totalZakat + totalPCB;

      // Calculate total employer contributions
      const totalEmployerContributions = totalEmployerEPF + totalEmployerSOCSO + totalEmployerEIS;

      const eaFormData = {
        year: year,
        generatedDate: new Date(),

        // Employer Information
        employer: {
          name: companyName,
          address: company?.address || {},
          taxNumber: company?.taxNumber || 'N/A',
          epfNumber: company?.epfNumber || 'N/A',
          socsoNumber: company?.socsoNumber || 'N/A'
        },

        // Employee Information
        employee: {
          id: employeeId,
          name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
          icNumber: employee.icNumber || employee.nric || 'N/A',
          passportNumber: employee.passport || '',
          address: employee.address || 'N/A',
          taxNumber: employee.taxNumber || 'N/A',
          epfNumber: employee.epfNumber || 'N/A',
          position: employee.position || 'N/A',
          department: employee.department || 'N/A',
          email: employee.email || 'N/A',
          phone: employee.phone || 'N/A',
          bankName: employee.bankName || 'N/A',
          accountNumber: employee.accountNumber || 'N/A'
        },

        // Employment Details
        employment: {
          joinDate: employee.joinDate,
          resignDate: employee.resignDate || null,
          monthsWorked: payslips.length
        },

        // Income Details
        income: {
          basicSalary: parseFloat(totalBasicSalary.toFixed(2)),
          grossSalary: parseFloat(totalGrossSalary.toFixed(2)),
          allowances: 0, // Can be extended later
          bonuses: 0, // Can be extended later
          overtime: 0, // Can be extended later
          totalIncome: parseFloat(totalGrossSalary.toFixed(2))
        },

        // Employee Statutory Deductions
        employeeDeductions: {
          epf: parseFloat(totalEmployeeEPF.toFixed(2)),
          socso: parseFloat(totalEmployeeSOCSO.toFixed(2)),
          eis: parseFloat(totalEmployeeEIS.toFixed(2)),
          zakat: parseFloat(totalZakat.toFixed(2)),
          pcb: parseFloat(totalPCB.toFixed(2)),
          total: parseFloat(totalDeductions.toFixed(2))
        },

        // Employer Statutory Contributions
        employerContributions: {
          epf: parseFloat(totalEmployerEPF.toFixed(2)),
          socso: parseFloat(totalEmployerSOCSO.toFixed(2)),
          eis: parseFloat(totalEmployerEIS.toFixed(2)),
          total: parseFloat(totalEmployerContributions.toFixed(2))
        },

        // Net Income
        netIncome: parseFloat(totalNetSalary.toFixed(2)),

        // Monthly Breakdown
        monthlyBreakdown: payslips.map(p => ({
          month: p.month,
          grossSalary: parseFloat(p.grossSalary || 0),
          epf: parseFloat(p.employeeEPF || 0),
          socso: parseFloat(p.employeeSOCSO || 0),
          eis: parseFloat(p.employeeEIS || 0),
          pcb: parseFloat(p.mtdPCB || 0),
          netSalary: parseFloat(p.netSalary || 0)
        })).sort((a, b) => a.month.localeCompare(b.month))
      };

      console.log('✅ EA Form data calculated:', eaFormData);
      return eaFormData;

    } catch (error) {
      console.error('❌ Error calculating EA Form data:', error);
      throw error;
    }
  }

  /**
   * Save EA Form to Firestore
   */
  async saveEAForm(eaFormData) {
    try {
      const eaFormRef = await addDoc(collection(db, 'eaForms'), {
        ...eaFormData,
        createdAt: serverTimestamp()
      });

      console.log('✅ EA Form saved with ID:', eaFormRef.id);
      return eaFormRef.id;
    } catch (error) {
      console.error('❌ Error saving EA Form:', error);
      throw error;
    }
  }

  /**
   * Get EA Form for employee and year
   */
  async getEAForm(employeeId, year) {
    try {
      const eaFormsQuery = query(
        collection(db, 'eaForms'),
        where('employee.id', '==', employeeId),
        where('year', '==', year)
      );

      const snapshot = await getDocs(eaFormsQuery);

      if (snapshot.empty) {
        return null;
      }

      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } catch (error) {
      console.error('❌ Error getting EA Form:', error);
      throw error;
    }
  }

  /**
   * Get all EA Forms for a company and year
   */
  async getCompanyEAForms(companyName, year) {
    try {
      const eaFormsQuery = query(
        collection(db, 'eaForms'),
        where('employer.name', '==', companyName),
        where('year', '==', year)
      );

      const snapshot = await getDocs(eaFormsQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('❌ Error getting company EA Forms:', error);
      throw error;
    }
  }

  /**
   * Generate EA Form PDF
   */
  async generateEAFormPDF(eaFormData) {
    try {
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      // Header - Title
      doc.setFillColor(25, 118, 210);
      doc.rect(0, 0, pageWidth, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('FORM EA', pageWidth / 2, 18, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`BORANG E.A. (${eaFormData.year})`, pageWidth / 2, 28, { align: 'center' });
      doc.text('Employer\'s Annual Return / Penyata Tahunan Majikan', pageWidth / 2, 35, { align: 'center' });

      yPos = 50;
      doc.setTextColor(0, 0, 0);

      // Employer Information
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('EMPLOYER INFORMATION / MAKLUMAT MAJIKAN', 15, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Company Name: ${eaFormData.employer.name}`, 15, yPos);
      yPos += 6;

      if (eaFormData.employer.address.line1) {
        doc.text(`Address: ${eaFormData.employer.address.line1}`, 15, yPos);
        yPos += 6;
        if (eaFormData.employer.address.line2) {
          doc.text(`         ${eaFormData.employer.address.line2}`, 15, yPos);
          yPos += 6;
        }
        doc.text(`         ${eaFormData.employer.address.postcode} ${eaFormData.employer.address.city}, ${eaFormData.employer.address.state}`, 15, yPos);
        yPos += 6;
      }

      doc.text(`Employer Tax No: ${eaFormData.employer.taxNumber}`, 15, yPos);
      doc.text(`EPF No: ${eaFormData.employer.epfNumber}`, 120, yPos);
      yPos += 10;

      // Draw line separator
      doc.setDrawColor(200, 200, 200);
      doc.line(15, yPos, pageWidth - 15, yPos);
      yPos += 8;

      // Employee Information
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('EMPLOYEE INFORMATION / MAKLUMAT PEKERJA', 15, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${eaFormData.employee.name}`, 15, yPos);
      doc.text(`IC/Passport: ${eaFormData.employee.icNumber}`, 120, yPos);
      yPos += 6;
      doc.text(`Position: ${eaFormData.employee.position}`, 15, yPos);
      doc.text(`Department: ${eaFormData.employee.department}`, 120, yPos);
      yPos += 6;
      doc.text(`Tax No: ${eaFormData.employee.taxNumber}`, 15, yPos);
      doc.text(`EPF No: ${eaFormData.employee.epfNumber}`, 120, yPos);
      yPos += 10;

      // Draw line separator
      doc.line(15, yPos, pageWidth - 15, yPos);
      yPos += 8;

      // Income Summary Table
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('INCOME SUMMARY / RINGKASAN PENDAPATAN', 15, yPos);
      yPos += 6;

      doc.autoTable({
        startY: yPos,
        head: [['Description / Penerangan', 'Amount (RM)']],
        body: [
          ['Basic Salary / Gaji Pokok', `RM ${eaFormData.income.basicSalary.toFixed(2)}`],
          ['Gross Salary / Jumlah Gaji Kasar', `RM ${eaFormData.income.grossSalary.toFixed(2)}`],
          ['TOTAL INCOME / JUMLAH PENDAPATAN', `RM ${eaFormData.income.totalIncome.toFixed(2)}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [25, 118, 210], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 60, halign: 'right', fontStyle: 'bold' }
        }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // Deductions Table
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('STATUTORY DEDUCTIONS / POTONGAN BERKANUN', 15, yPos);
      yPos += 6;

      doc.autoTable({
        startY: yPos,
        head: [['Deduction Type / Jenis Potongan', 'Employee / Pekerja', 'Employer / Majikan']],
        body: [
          [
            'EPF / KWSP',
            `RM ${eaFormData.employeeDeductions.epf.toFixed(2)}`,
            `RM ${eaFormData.employerContributions.epf.toFixed(2)}`
          ],
          [
            'SOCSO / PERKESO',
            `RM ${eaFormData.employeeDeductions.socso.toFixed(2)}`,
            `RM ${eaFormData.employerContributions.socso.toFixed(2)}`
          ],
          [
            'EIS / SIP',
            `RM ${eaFormData.employeeDeductions.eis.toFixed(2)}`,
            `RM ${eaFormData.employerContributions.eis.toFixed(2)}`
          ],
          [
            'Zakat',
            `RM ${eaFormData.employeeDeductions.zakat.toFixed(2)}`,
            '-'
          ],
          [
            'PCB / MTD',
            `RM ${eaFormData.employeeDeductions.pcb.toFixed(2)}`,
            '-'
          ],
          [
            'TOTAL / JUMLAH',
            `RM ${eaFormData.employeeDeductions.total.toFixed(2)}`,
            `RM ${eaFormData.employerContributions.total.toFixed(2)}`
          ]
        ],
        theme: 'grid',
        headStyles: { fillColor: [25, 118, 210], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 50, halign: 'right' },
          2: { cellWidth: 50, halign: 'right' }
        }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // Net Income
      doc.setFillColor(76, 175, 80);
      doc.rect(15, yPos, pageWidth - 30, 15, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('NET INCOME / PENDAPATAN BERSIH:', 20, yPos + 10);
      doc.text(`RM ${eaFormData.netIncome.toFixed(2)}`, pageWidth - 20, yPos + 10, { align: 'right' });

      yPos += 20;
      doc.setTextColor(0, 0, 0);

      // Add new page if needed
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 20;
      }

      // Monthly Breakdown
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('MONTHLY BREAKDOWN / PECAHAN BULANAN', 15, yPos);
      yPos += 6;

      const monthlyData = eaFormData.monthlyBreakdown.map(m => [
        m.month,
        `RM ${m.grossSalary.toFixed(2)}`,
        `RM ${m.epf.toFixed(2)}`,
        `RM ${m.pcb.toFixed(2)}`,
        `RM ${m.netSalary.toFixed(2)}`
      ]);

      doc.autoTable({
        startY: yPos,
        head: [['Month', 'Gross', 'EPF', 'PCB', 'Net']],
        body: monthlyData,
        theme: 'striped',
        headStyles: { fillColor: [25, 118, 210], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 35, halign: 'right' },
          2: { cellWidth: 30, halign: 'right' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 35, halign: 'right' }
        }
      });

      // Footer
      yPos = pageHeight - 20;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-MY')}`, 15, yPos);
      doc.text('This is a computer-generated document. No signature is required.', 15, yPos + 4);
      doc.text(`Page 1 of 1`, pageWidth - 15, yPos, { align: 'right' });

      return doc;

    } catch (error) {
      console.error('❌ Error generating EA Form PDF:', error);
      throw error;
    }
  }

  /**
   * Download EA Form PDF
   */
  async downloadEAFormPDF(eaFormData) {
    try {
      const pdf = await this.generateEAFormPDF(eaFormData);
      const fileName = `EA_Form_${eaFormData.year}_${eaFormData.employee.name.replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);
      console.log('✅ EA Form PDF downloaded:', fileName);
      return true;
    } catch (error) {
      console.error('❌ Error downloading EA Form PDF:', error);
      throw error;
    }
  }
}

export const eaFormService = new EAFormService();
