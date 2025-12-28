## Yard - Whatsapp AI Powered Real Estate Housing Agent

**Yard** is an AI-powered WhatsApp chatbot that helps users **find houses and real estate properties** quickly. It leverages **OpenAI GPT** for natural language understanding and **AWS Lambda** for serverless deployment.

<img width="946" height="442" alt="Yard" src="https://github.com/user-attachments/assets/b602499c-fe62-4cbc-8778-37836c98ff78" />

##  Features

- Chat with the bot on WhatsApp  
- AI-driven property search and recommendations  
- Serverless and scalable architecture  
- Automated CI/CD pipeline for seamless updates  

---

##  Tech Stack & AWS Services

| Layer | Technology / Service |
|-------|--------------------|
| Backend | Node.js (ES Modules) |
| AI | OpenAI GPT |
| Messaging | WhatsApp Cloud API |
| Serverless | AWS Lambda |
| Database | Amazon DynamoDB (stores property listings & user queries) |
| CI/CD | AWS CodePipeline + CodeBuild |
| Storage | Amazon S3 (build artifacts) |
| IAM & Security | AWS IAM Roles |
| Monitoring | AWS CloudWatch |

---

**Workflow:**

1. Push code to GitHub → triggers **CodePipeline**  
2. **CodeBuild** packages Lambda into (`.zip`) file. 
3. Deploy stage → updates Lambda automatically.  
4. Lambda interacts with WhatsApp and DynamoDB to serve property data  






