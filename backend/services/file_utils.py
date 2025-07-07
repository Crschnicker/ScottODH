# backend/services/file_utils.py
import os
from io import BytesIO
from datetime import datetime
from flask import make_response
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
import logging

logger = logging.getLogger(__name__)

def generate_bid_report(bid):
    """Generate a PDF report for a bid"""
    try:
        # Get all necessary data
        customer = bid.estimate.customer_direct_link
        doors = bid.doors
        
        # Calculate all the necessary values
        total_parts_cost = 0
        total_labor_cost = 0
        total_hardware_cost = 0
        
        for door in doors:
            door_parts_cost = 0
            door_labor_cost = 0
            door_hardware_cost = 0
            
            for item in door.line_items:
                item_total = item.price * item.quantity
                door_parts_cost += item_total
                door_labor_cost += item.labor_hours * 47.02  # $47.02 per hour labor rate
                door_hardware_cost += item.hardware
                
            total_parts_cost += door_parts_cost
            total_labor_cost += door_labor_cost
            total_hardware_cost += door_hardware_cost
        
        # Calculate tax (8.75%)
        tax_rate = 0.0875
        tax_amount = (total_parts_cost + total_hardware_cost) * tax_rate
        total_cost = total_parts_cost + total_labor_cost + total_hardware_cost + tax_amount
        
        # Create a PDF buffer
        buffer = BytesIO()
        
        # Create the PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        # Container for the 'Flowable' objects
        elements = []
        
        # Define styles
        styles = getSampleStyleSheet()
        title_style = styles['Heading1']
        heading2_style = styles['Heading2']
        heading3_style = styles['Heading3']
        normal_style = styles['Normal']
        
        # Add the report title
        elements.append(Paragraph(f"Bid Report #{bid.id}", title_style))
        elements.append(Spacer(1, 0.25*inch))
        
        # Add the date
        current_date = datetime.now().strftime("%B %d, %Y")
        elements.append(Paragraph(f"Date: {current_date}", normal_style))
        elements.append(Spacer(1, 0.25*inch))
        
        # Add company info
        elements.append(Paragraph("Scott Overhead Doors", heading2_style))
        elements.append(Paragraph("123 Main Street", normal_style))
        elements.append(Paragraph("Anytown, CA 92000", normal_style))
        elements.append(Paragraph("Phone: (555) 555-5555", normal_style))
        elements.append(Spacer(1, 0.25*inch))
        
        # Add customer info
        elements.append(Paragraph("Customer Information", heading2_style))
        elements.append(Paragraph(f"Name: {customer.name}", normal_style))
        elements.append(Paragraph(f"Address: {customer.address or 'N/A'}", normal_style))
        elements.append(Paragraph(f"Contact: {customer.contact_name or 'N/A'}", normal_style))
        elements.append(Paragraph(f"Phone: {customer.phone or 'N/A'}", normal_style))
        elements.append(Paragraph(f"Email: {customer.email or 'N/A'}", normal_style))
        elements.append(Spacer(1, 0.25*inch))
        
        # Add cost summary
        elements.append(Paragraph("Cost Summary", heading2_style))
        
        summary_data = [
            ["Description", "Amount"],
            ["Total Parts Cost", f"${total_parts_cost:.2f}"],
            ["Total Labor Cost", f"${total_labor_cost:.2f}"],
            ["Total Hardware Cost", f"${total_hardware_cost:.2f}"],
            ["Tax (8.75%)", f"${tax_amount:.2f}"],
            ["Total Cost", f"${total_cost:.2f}"]
        ]
        
        summary_table = Table(summary_data)
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (1, 0), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.black),
            ('ALIGN', (0, 0), (1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (1, 0), 12),
            ('BACKGROUND', (0, -1), (1, -1), colors.lightgrey),
            ('FONTNAME', (0, -1), (1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(summary_table)
        elements.append(Spacer(1, 0.25*inch))
        
        # Add door details
        elements.append(Paragraph("Door Details", heading2_style))
        
        for door in doors:
            elements.append(Paragraph(f"Door #{door.door_number}", heading3_style))
            
            # Calculate door totals
            door_parts_cost = 0
            door_labor_cost = 0
            door_hardware_cost = 0
            
            door_data = [["Part Number", "Description", "Quantity", "Price", "Labor Hours", "Hardware", "Total"]]
            
            for item in door.line_items:
                item_total = item.price * item.quantity
                door_parts_cost += item_total
                door_labor_cost += item.labor_hours * 47.02
                door_hardware_cost += item.hardware
                
                door_data.append([
                    item.part_number or 'N/A',
                    item.description or 'N/A',
                    str(item.quantity),
                    f"${item.price:.2f}",
                    str(item.labor_hours),
                    f"${item.hardware:.2f}",
                    f"${item_total:.2f}"
                ])
            
            door_total = door_parts_cost + door_labor_cost + door_hardware_cost
            door_data.append(["", "", "", "", "", "Door Total:", f"${door_total:.2f}"])
            
            door_table = Table(door_data)
            door_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            elements.append(door_table)
            elements.append(Spacer(1, 0.25*inch))
        
        # Add footer
        elements.append(Paragraph(f"Report generated on {current_date}", normal_style))
        elements.append(Paragraph("Scott Overhead Doors - Confidential", normal_style))
        
        # Build the PDF
        doc.build(elements)
        
        # Set the file pointer to the beginning of the buffer
        buffer.seek(0)
        
        # Create a response with the PDF
        response = make_response(buffer.getvalue())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=bid_report_{bid.id}.pdf'
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating bid report: {str(e)}")
        raise

def generate_bid_proposal(bid):
    """Generate a PDF proposal for a bid"""
    try:
        # Get all necessary data
        customer = bid.estimate.customer_direct_link
        doors = bid.doors
        
        # Calculate all the necessary values
        total_parts_cost = 0
        total_labor_cost = 0
        total_hardware_cost = 0
        
        for door in doors:
            door_parts_cost = 0
            door_labor_cost = 0
            door_hardware_cost = 0
            
            for item in door.line_items:
                item_total = item.price * item.quantity
                door_parts_cost += item_total
                door_labor_cost += item.labor_hours * 47.02
                door_hardware_cost += item.hardware
                
            total_parts_cost += door_parts_cost
            total_labor_cost += door_labor_cost
            total_hardware_cost += door_hardware_cost
        
        # Calculate tax (8.75%)
        tax_rate = 0.0875
        tax_amount = (total_parts_cost + total_hardware_cost) * tax_rate
        total_cost = total_parts_cost + total_labor_cost + total_hardware_cost + tax_amount
        
        # Create a PDF buffer
        buffer = BytesIO()
        
        # Create the PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        # Container for the 'Flowable' objects
        elements = []
        
        # Define styles
        styles = getSampleStyleSheet()
        
        # Custom styles for a more professional look
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=24,
            leading=30,
            alignment=1,  # Center alignment
            spaceAfter=24
        )
        
        section_title_style = ParagraphStyle(
            'SectionTitle',
            parent=styles['Heading2'],
            fontSize=14,
            leading=18,
            spaceBefore=12,
            spaceAfter=6,
            textColor=colors.darkblue
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=10,
            leading=14,
            spaceAfter=3
        )
        
        bold_style = ParagraphStyle(
            'BoldText',
            parent=normal_style,
            fontName='Helvetica-Bold'
        )
        
        # Add the proposal title
        elements.append(Paragraph("PROPOSAL", title_style))
        
        # Create a table for header information
        current_date = datetime.now().strftime("%B %d, %Y")
        header_data = [
            [Paragraph(f"Proposal #: P-{bid.id}", normal_style)],
            [Paragraph(f"Date: {current_date}", normal_style)]
        ]
        
        header_table = Table(header_data, colWidths=[450])
        header_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        elements.append(header_table)
        elements.append(Spacer(1, 0.1*inch))
        
        # Company and Customer info in a two-column layout
        company_data = [
            [Paragraph("<b>Scott Overhead Doors</b>", bold_style), 
             Paragraph("<b>Prepared For:</b>", bold_style)],
            [Paragraph("123 Main Street", normal_style), 
             Paragraph(f"{customer.name}", bold_style)],
            [Paragraph("Anytown, CA 92000", normal_style), 
             Paragraph(f"{customer.address or 'Address on file'}", normal_style)],
            [Paragraph("Phone: (555) 555-5555", normal_style), 
             Paragraph(f"Contact: {customer.contact_name or 'N/A'}", normal_style)],
            [Paragraph("License #: 123456", normal_style), 
             Paragraph(f"Phone: {customer.phone or 'N/A'}", normal_style)],
            [Paragraph("", normal_style), 
             Paragraph(f"Email: {customer.email or 'N/A'}", normal_style)]
        ]
        
        company_table = Table(company_data, colWidths=[225, 225])
        company_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        
        elements.append(company_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Add pricing details
        elements.append(Paragraph("Investment Details", section_title_style))
        
        price_data = [
            ["Description", "Quantity", "Amount"]
        ]
        
        for door in doors:
            # Calculate door total
            door_parts_cost = 0
            door_labor_cost = 0
            door_hardware_cost = 0
            
            for item in door.line_items:
                item_total = item.price * item.quantity
                door_parts_cost += item_total
                door_labor_cost += item.labor_hours * 47.02
                door_hardware_cost += item.hardware
            
            door_total = door_parts_cost + door_labor_cost + door_hardware_cost
            
            price_data.append([
                f"Door #{door.door_number} - Complete installation and materials",
                "1",
                f"${door_total:.2f}"
            ])
        
        subtotal = total_parts_cost + total_labor_cost + total_hardware_cost
        
        price_data.append(["", "", ""])  # Empty row for spacing
        price_data.append(["Subtotal:", "", f"${subtotal:.2f}"])
        price_data.append(["Tax (8.75%):", "", f"${tax_amount:.2f}"])
        price_data.append(["Total Investment:", "", f"${total_cost:.2f}"])
        
        price_table = Table(price_data, colWidths=[250, 75, 125])
        price_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, 0), 1, colors.darkblue),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.darkblue),
            ('LINEABOVE', (0, 1), (-1, 1), 1, colors.lightgrey),
            ('LINEBELOW', (0, -4), (-1, -4), 1, colors.lightgrey),
            ('ALIGN', (1, 1), (1, -1), 'CENTER'),
            ('ALIGN', (2, 1), (2, -1), 'RIGHT'),
            ('LINEBELOW', (0, -2), (-1, -2), 1, colors.black),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('TEXTCOLOR', (0, -1), (-1, -1), colors.darkblue),
        ]))
        
        elements.append(price_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Add terms
        elements.append(Paragraph("Terms and Conditions", section_title_style))
        
        terms_style = ParagraphStyle(
            'TermsStyle',
            parent=normal_style,
            leftIndent=10,
            firstLineIndent=-10
        )
        
        elements.append(Paragraph("1. Payment Terms: 50% deposit required to schedule work. Remaining balance due upon completion.", terms_style))
        elements.append(Paragraph("2. Warranty: All work is guaranteed for one year from the date of installation.", terms_style))
        elements.append(Paragraph("3. Timeline: Work to be completed within 4-6 weeks of approval, subject to material availability.", terms_style))
        elements.append(Paragraph("4. This proposal is valid for 30 days from the date issued.", terms_style))
        elements.append(Spacer(1, 0.4*inch))
        
        # Add signature section
        signature_data = [
            ["Approved By:", "Date:"],
            ["", ""],
            [customer.name, ""]
        ]
        
        signature_table = Table(signature_data, colWidths=[225, 225])
        signature_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
            ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
            ('LINEBELOW', (0, 1), (0, 1), 1, colors.black),
            ('LINEBELOW', (1, 1), (1, 1), 1, colors.black),
            ('TOPPADDING', (0, 1), (1, 1), 36),
            ('BOTTOMPADDING', (0, 1), (1, 1), 6),
        ]))
        
        elements.append(signature_table)
        elements.append(Spacer(1, 0.5*inch))
        
        # Add footer
        footer_style = ParagraphStyle(
            'FooterStyle',
            parent=normal_style,
            alignment=1,  # Center
            textColor=colors.darkgrey,
            fontSize=9
        )
        
        elements.append(Paragraph("Thank you for the opportunity to earn your business!", footer_style))
        elements.append(Paragraph("Scott Overhead Doors - Quality Service Since 1985", footer_style))
        
        # Build the PDF
        doc.build(elements)
        
        # Set the file pointer to the beginning of the buffer
        buffer.seek(0)
        
        # Create a response with the PDF
        response = make_response(buffer.getvalue())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'inline; filename=proposal_{bid.id}.pdf'
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating bid proposal: {str(e)}")
        raise