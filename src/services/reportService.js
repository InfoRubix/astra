import jsPDF from 'jspdf';
import { format } from 'date-fns';

class ReportService {
  generateDashboardReport(dashboardData, selectedMonth) {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      
      // Report Header
      doc.setFontSize(20);
      doc.setTextColor(25, 118, 210);
      doc.text('Admin Dashboard Report', margin, 30);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, 40);
      doc.text(`Report Period: ${format(selectedMonth, 'MMMM yyyy')}`, margin, 50);
      
      // Add horizontal line
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, 55, pageWidth - margin, 55);
      
      let yPosition = 70;
      
      // Today's Statistics Section
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Today\'s Statistics', margin, yPosition);
      yPosition += 15;
      
      // Statistics data
      const stats = [
        ['Total Employees', dashboardData.todayStats.totalEmployees.toString()],
        ['Present Today', dashboardData.todayStats.presentToday.toString()],
        ['On Leave', dashboardData.todayStats.onLeave.toString()],
        ['Late Arrivals', dashboardData.todayStats.lateArrivals.toString()],
        ['Attendance Rate', `${dashboardData.todayStats.attendanceRate}%`]
      ];
      
      // Create simple table with text
      doc.setFontSize(12);
      doc.setTextColor(25, 118, 210);
      doc.text('Metric', margin, yPosition);
      doc.text('Value', margin + 100, yPosition);
      yPosition += 8;
      
      // Add underline
      doc.line(margin, yPosition - 3, margin + 120, yPosition - 3);
      yPosition += 5;
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      stats.forEach(([metric, value]) => {
        doc.text(metric, margin, yPosition);
        doc.text(value, margin + 100, yPosition);
        yPosition += 8;
      });
      
      yPosition += 15;
      
      // Company Distribution Section
      if (dashboardData.companyStats && dashboardData.companyStats.length > 0) {
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text('Company Distribution', margin, yPosition);
        yPosition += 15;
        
        doc.setFontSize(12);
        doc.setTextColor(25, 118, 210);
        doc.text('Company', margin, yPosition);
        doc.text('Employees', margin + 80, yPosition);
        doc.text('Percentage', margin + 130, yPosition);
        yPosition += 8;
        
        // Add underline
        doc.line(margin, yPosition - 3, margin + 170, yPosition - 3);
        yPosition += 5;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        dashboardData.companyStats.forEach(company => {
          const percentage = ((company.value / dashboardData.todayStats.totalEmployees) * 100).toFixed(1);
          doc.text(company.name, margin, yPosition);
          doc.text(company.value.toString(), margin + 80, yPosition);
          doc.text(`${percentage}%`, margin + 130, yPosition);
          yPosition += 8;
        });
        
        yPosition += 15;
      }
      
      // Leave Approvals Section removed from report
      
      // Daily Attendance Overview Section
      if (dashboardData.weeklyAttendance && dashboardData.weeklyAttendance.length > 0) {
        // Check if we need a new page
        if (yPosition > 180) {
          doc.addPage();
          yPosition = 30;
        }
        
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(`Daily Attendance - ${format(selectedMonth, 'MMMM yyyy')}`, margin, yPosition);
        yPosition += 15;
        
        // Summary statistics
        const attendanceData = dashboardData.weeklyAttendance;
        const totalDays = attendanceData.length;
        const avgAttendance = totalDays > 0 ? 
          (attendanceData.reduce((sum, day) => sum + day.attendance, 0) / totalDays).toFixed(1) : '0';
        const avgPercentage = totalDays > 0 ? 
          (attendanceData.reduce((sum, day) => sum + day.percentage, 0) / totalDays).toFixed(1) : '0';
        
        const today = new Date();
        const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(today, 'yyyy-MM');
        
        doc.setFontSize(12);
        doc.text(`Total Days${isCurrentMonth ? ' (up to today)' : ''}: ${totalDays}`, margin, yPosition);
        yPosition += 8;
        doc.text(`Average Daily Attendance: ${avgAttendance} employees`, margin, yPosition);
        yPosition += 8;
        doc.text(`Average Attendance Rate: ${avgPercentage}%`, margin, yPosition);
        yPosition += 15;
        
        // All daily data from 1st until today
        if (attendanceData.length > 0) {
          doc.setFontSize(10);
          doc.setTextColor(25, 118, 210);
          doc.text('Date', margin, yPosition);
          doc.text('Attendance', margin + 60, yPosition);
          doc.text('Rate', margin + 120, yPosition);
          yPosition += 8;
          
          doc.line(margin, yPosition - 3, margin + 150, yPosition - 3);
          yPosition += 5;
          
          doc.setTextColor(0, 0, 0);
          
          // Show all data but in chunks to fit on pages
          let dataIndex = 0;
          while (dataIndex < attendanceData.length) {
            // Check if we need a new page
            if (yPosition > 250) {
              doc.addPage();
              yPosition = 30;
              doc.setFontSize(16);
              doc.setTextColor(0, 0, 0);
              doc.text(`Daily Attendance - ${format(selectedMonth, 'MMMM yyyy')} (continued)`, margin, yPosition);
              yPosition += 20;
              
              // Re-add headers
              doc.setFontSize(10);
              doc.setTextColor(25, 118, 210);
              doc.text('Date', margin, yPosition);
              doc.text('Attendance', margin + 60, yPosition);
              doc.text('Rate', margin + 120, yPosition);
              yPosition += 8;
              doc.line(margin, yPosition - 3, margin + 150, yPosition - 3);
              yPosition += 5;
              doc.setTextColor(0, 0, 0);
            }
            
            const day = attendanceData[dataIndex];
            doc.text(day.day, margin, yPosition);
            doc.text(day.attendance.toString(), margin + 60, yPosition);
            doc.text(`${day.percentage}%`, margin + 120, yPosition);
            yPosition += 8;
            dataIndex++;
          }
          
          yPosition += 5;
          doc.setTextColor(100, 100, 100);
          doc.text(`Complete daily attendance from 1st until today: ${attendanceData.length} days total`, margin, yPosition);
        }
      }
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Page ${i} of ${pageCount} | Generated by Attendance Management System`,
          pageWidth / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }
      
      // Save the PDF
      const filename = `dashboard-report-${format(selectedMonth, 'yyyy-MM')}-${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`;
      doc.save(filename);
      
      return { success: true, filename };
    } catch (error) {
      console.error('Error generating report:', error);
      return { success: false, error: error.message };
    }
  }
  
  generateDetailedReport(dashboardData, selectedMonth, additionalData = {}) {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      
      // Enhanced Report Header
      doc.setFontSize(24);
      doc.setTextColor(25, 118, 210);
      doc.text('Detailed Administrative Report', margin, 30);
      
      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text(`Report Period: ${format(selectedMonth, 'MMMM yyyy')}`, margin, 45);
      doc.text(`Generated: ${format(new Date(), 'EEEE, dd/MM/yyyy at HH:mm')}`, margin, 55);
      
      // Add company info if available
      if (additionalData.companyName) {
        doc.text(`Company: ${additionalData.companyName}`, margin, 65);
      }
      
      // Add horizontal line
      doc.setDrawColor(25, 118, 210);
      doc.setLineWidth(1);
      doc.line(margin, 75, pageWidth - margin, 75);
      
      let yPosition = 90;
      
      // Executive Summary
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('Executive Summary', margin, yPosition);
      yPosition += 15;
      
      const summaryText = [
        `• Total workforce: ${dashboardData.todayStats.totalEmployees} employees`,
        `• Current attendance rate: ${dashboardData.todayStats.attendanceRate}%`,
        `• Employees on leave today: ${dashboardData.todayStats.onLeave} employees`,
        `• Late arrivals today: ${dashboardData.todayStats.lateArrivals} employees`
      ];
      
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      summaryText.forEach(text => {
        doc.text(text, margin, yPosition);
        yPosition += 8;
      });
      
      yPosition += 15;
      
      // Call the standard report generation for the rest
      return this.generateDashboardReport(dashboardData, selectedMonth);
      
    } catch (error) {
      console.error('Error generating detailed report:', error);
      return { success: false, error: error.message };
    }
  }
}

export const reportService = new ReportService();
export default reportService;