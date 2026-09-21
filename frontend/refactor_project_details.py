import re
import sys

def main():
    path = 'src/components/ProjectDetails.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()
    
    start_cost = code.find('{/* Cost Escalation Driver Analysis Module (from Nirmaan Drishti) */}')
    end_nlp = code.find('{/* /pd-section-escalation */}')
    nlp_start = code.find('{/* AI Natural Language Explanation (QWEN3-8B) Section */}')
    
    if start_cost == -1 or end_nlp == -1 or nlp_start == -1:
        print("Could not find markers")
        return

    nlp_code = code[nlp_start:end_nlp]
    
    # Replace the card wrapper with an inner wrapper
    new_nlp_code = nlp_code.replace(
        '<div className="card nlp-explanation-card" style={{ padding: \'24px\', borderRadius: \'16px\', marginTop: \'12px\', marginBottom: \'16px\' }}>',
        '<div className="nlp-explanation-inner" style={{ marginTop: \'24px\', paddingTop: \'24px\', borderTop: \'1px solid #E2E8F0\' }}>'
    )
    
    # Replace the title text
    new_nlp_code = new_nlp_code.replace(
        'AI NATURAL LANGUAGE EXPLANATION',
        'AI ESCALATION DRIVERS ANALYSIS (NARRATIVE)'
    )
    
    # Remove the section header subtitle that is no longer needed
    new_nlp_code = new_nlp_code.replace(
        'Model-specific natural language reasoning explaining "Why did the model predict this?" (3-Month Horizon)',
        'Model-specific natural language reasoning explaining the primary escalation drivers.'
    )
    
    # Splice everything back together, omitting the code between start_cost and nlp_start
    new_code = code[:start_cost] + new_nlp_code + code[end_nlp:]
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_code)
    
    print("Done refactoring ProjectDetails.tsx")

if __name__ == '__main__':
    main()
