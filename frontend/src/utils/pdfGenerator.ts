/**
 * Official Government of India / MoSPI PDF Document Generator
 * Generates authentic, official formatted MoSPI documents with GoI crest headers,
 * reference codes, structured metadata, and direct download/print-to-PDF triggers.
 */
import { MOSPI_LOGO_B64, GOV_HEADER_CSS } from './govHeader';

export interface TicketData {
  id: string;
  projectName: string;
  projectId: string;
  actionTitle: string;
  routedOfficer: string;
  status: string;
  priority: string;
  dateCreated: string;
  ministry: string;
  agency: string;
  description: string;
}

export interface DirectOrderData {
  orderNo: string;
  date: string;
  projectName: string;
  projectId: string;
  recipientOfficer: string;
  subject: string;
  directives: string[];
  issuedBy: string;
  designation: string;
}

export function generateTicketPDF(ticket: TicketData) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>MoSPI Official Action Ticket - ${ticket.id}</title>
      <style>
        body { font-family: 'Times New Roman', Times, serif; margin: 40px; color: #111; line-height: 1.5; }
        ${GOV_HEADER_CSS}
        .ref-box { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; font-weight: bold; }
        .title { text-align: center; font-size: 18px; font-weight: bold; text-decoration: underline; margin: 20px 0; text-transform: uppercase; }
        .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .meta-table th, .meta-table td { border: 1px solid #444; padding: 8px 12px; font-size: 13px; text-align: left; }
        .meta-table th { background-color: #f2f2f2; font-weight: bold; width: 30%; }
        .content-box { border: 1px solid #444; padding: 16px; min-height: 120px; margin-bottom: 40px; font-size: 14px; background: #fafafa; }
        .signature-block { float: right; width: 250px; text-align: center; margin-top: 50px; }
        .sig-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 4px; font-weight: bold; }
        .footer { position: fixed; bottom: 30px; left: 40px; right: 40px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 6px; }
        @media print { body { margin: 20px; } }
      </style>
    </head>
    <body>
      <div class="gov-header">
        <div class="gov-header-inner">
          <img src="${MOSPI_LOGO_B64}" alt="Government of India - MoSPI" class="gov-emblem-img" />
          <div class="gov-header-text">
            <div class="gov-title-line">Government of India</div>
            <div class="gov-ministry-line">Ministry of Statistics &amp; Programme Implementation</div>
            <div class="gov-dept-line">Infrastructure &amp; Project Monitoring Division (IPMD) &nbsp;|&nbsp; PAIMANA National Monitoring Portal</div>
          </div>
        </div>
      </div>

      <div class="ref-box">
        <div>Ref No: MoSPI/IPMD/TICKET/${ticket.id}</div>
        <div>Date: ${ticket.dateCreated}</div>
      </div>

      <div class="title">OFFICIAL INFRASTRUCTURE INTERVENTION TICKET</div>

      <table class="meta-table">
        <tr><th>Ticket ID</th><td><strong>${ticket.id}</strong></td></tr>
        <tr><th>Project Name</th><td><strong>${ticket.projectName}</strong> (ID: ${ticket.projectId})</td></tr>
        <tr><th>Ministry / Sector</th><td>${ticket.ministry}</td></tr>
        <tr><th>Implementing Agency</th><td>${ticket.agency}</td></tr>
        <tr><th>Routed Officer Position</th><td><strong>${ticket.routedOfficer}</strong></td></tr>
        <tr><th>Priority Classification</th><td><span style="color: ${ticket.priority === 'Critical' ? '#dc2626' : '#d97706'}; font-weight: bold;">[${ticket.priority.toUpperCase()}]</span></td></tr>
        <tr><th>Ticket Status</th><td><strong>${ticket.status.toUpperCase()}</strong></td></tr>
      </table>

      <h4 style="margin-bottom: 8px; font-size: 14px;">ACTION DIRECTIVE / INTERVENTION DETAILS:</h4>
      <div class="content-box">
        <p><strong>Action Title:</strong> ${ticket.actionTitle}</p>
        <p><strong>Escalation Directive:</strong> ${ticket.description}</p>
        <p style="margin-top: 12px; font-size: 12px; color: #444; font-style: italic;">
          Note: This ticket has been automatically generated under MoSPI PAIMANA Predictive Policy Framework and routed to the designated Nodal Officer for immediate compliance.
        </p>
      </div>

      <div class="signature-block">
        <div>For Ministry of Statistics & Programme Implementation</div>
        <div class="sig-line">Nodal Officer / Senior Director (IPMD)<br/>Government of India</div>
      </div>

      <div class="footer">
        PAIMANA Portal | Nirmaan Drishti, Madan Mohan Malaviya University of Technology, Gorakhpur | Official Document
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  }
}

export function generateMemoPDF(projectName: string, projectId: string, actionTitle: string, officer: string) {
  const dateStr = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>MoSPI Office Memorandum - ${projectId}</title>
      <style>
        body { font-family: 'Times New Roman', Times, serif; margin: 45px; color: #000; line-height: 1.6; }
        ${GOV_HEADER_CSS}
        .title-box { text-align: center; font-size: 16px; font-weight: bold; margin: 24px 0; text-transform: uppercase; text-decoration: underline; }
        .memo-ref { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; margin-bottom: 20px; }
        .para { text-indent: 40px; margin-bottom: 16px; font-size: 14px; text-align: justify; }
        .signature-block { float: right; width: 280px; text-align: center; margin-top: 60px; font-size: 13px; }
        .sig-line { border-top: 1px solid #000; margin-top: 50px; padding-top: 4px; font-weight: bold; }
        .copy-to { clear: both; padding-top: 40px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="gov-header">
        <div class="gov-header-inner">
          <img src="${MOSPI_LOGO_B64}" alt="Government of India - MoSPI" class="gov-emblem-img" />
          <div class="gov-header-text">
            <div class="gov-title-line">Government of India</div>
            <div class="gov-ministry-line">Ministry of Statistics &amp; Programme Implementation</div>
            <div class="gov-dept-line">Infrastructure &amp; Project Monitoring Division (IPMD) &nbsp;|&nbsp; PAIMANA National Monitoring Portal</div>
          </div>
        </div>
      </div>

      <div class="memo-ref">
        <div>No. MoSPI/IPMD/MEMO/2026/${projectId}</div>
        <div>Date: ${dateStr}</div>
      </div>

      <div class="title-box">OFFICE MEMORANDUM</div>

      <p class="para">
        <strong>SUBJECT: IMMEDIATE INTERVENTION REGARDING COST OVERRUN AND SCHEDULE DELAY IN ${projectName.toUpperCase()} (PROJECT CODE: ${projectId}).</strong>
      </p>

      <p class="para">
        1. As per the real-time predictive analytics generated by the PAIMANA Infrastructure Monitoring Platform, the project <strong>${projectName}</strong> has triggered critical risk thresholds for schedule delay and cost escalation.
      </p>

      <p class="para">
        2. In pursuance of policy directive <strong>"${actionTitle}"</strong>, the competent authority has designated <strong>${officer}</strong> as the responsible officer to initiate corrective measures, resolve land/right-of-way bottlenecks, and submit an updated milestone recovery timeline within 14 calendar days.
      </p>

      <p class="para">
        3. This issues with the approval of Member Secretary / Joint Secretary (IPMD), Ministry of Statistics & Programme Implementation.
      </p>

      <div class="signature-block">
        <div>(Director - Infrastructure Monitoring)</div>
        <div class="sig-line">Ministry of Statistics & Programme Implementation<br/>Tel: 011-23340000 | Email: ipmd-mospi@gov.in</div>
      </div>

      <div class="copy-to">
        <strong>Copy to:</strong><br/>
        1. ${officer} - for immediate compliance and action report.<br/>
        2. Secretary, Concerned Administrative Ministry.<br/>
        3. PAIMANA Central Monitoring Cell, MoSPI, New Delhi.
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  }
}
