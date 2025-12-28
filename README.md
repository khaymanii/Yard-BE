## Yard - Whatsapp AI Powered Real Estate Housing Agent

**Yard** is an AI-powered WhatsApp chatbot that helps users **find houses and real estate properties** quickly. It leverages **OpenAI GPT** for natural language understanding and **AWS Lambda** for serverless deployment.

<img width="946" height="442" alt="Yard" src="https://github.com/user-attachments/assets/b602499c-fe62-4cbc-8778-37836c98ff78" />

## 🚀 Why Yard?

Most property platforms lose users due to:

- App download friction
- Poor mobile performance
- Low engagement after first visit

**Yard flips the model** by meeting users where they already are — **WhatsApp**.

### Key Benefits for PropTech Companies

- Zero app install required
- Higher engagement and response rates
- Faster property discovery
- Reduced mobile engineering costs
- Works on any smartphone

---

## 🧠 Core Features

- WhatsApp webhook integration
- AI-powered intent extraction (natural language search)
- Location, price, and feature-based property filtering
- Conversation memory (last search context)
- Idempotent message handling
- Automated inspection booking confirmations
- Stateless, scalable backend architecture

---

## 🏗️ System Architecture

User (WhatsApp)
|
v
WhatsApp Cloud API
|
v
AWS API Gateway
|
v
AWS Lambda (Node.js)
|
├── OpenAI / LLM (Intent Extraction)
├── DynamoDB (Search Memory, Listings)
├── CloudWatch (Logs & Metrics)
|
v
WhatsApp Message Response

---

## ⚙️ Infrastructure Breakdown

### API & Compute

- **AWS API Gateway** – webhook entry point
- **AWS Lambda** – stateless message processing

### Data Layer

- **Amazon DynamoDB**
  - User search history
  - Processed message tracking (idempotency)
  - Property listings
  - TTL-based cleanup

### CI/CD Pipeline

- **AWS CodePipeline** – pipeline orchestration
- **AWS CodeBuild** – build & packaging
- **AWS CodeDeploy** – Lambda deployments
- **Amazon S3** – build artifact storage

### Observability

- **Amazon CloudWatch**
  - Logs
  - Metrics
  - Alarms
  - Error tracking

### Security

- **AWS IAM**
  - Least-privilege roles
  - Secure service-to-service access
- Environment-based secrets injection
- No hardcoded credentials

---

## 🔁 CI/CD Flow

GitHub Push
↓
CodePipeline
↓
CodeBuild (Install, Test, Bundle)
↓
S3 (Artifacts)
↓
CodeDeploy
↓
AWS Lambda (Live)

Deployments are **automated, repeatable, and rollback-safe**.

---

## 📈 Scaling Strategy

- Serverless-first design
- Auto-scales with traffic
- DynamoDB on-demand capacity
- No infrastructure maintenance overhead
- Designed to handle traffic spikes (campaigns, launches)

---

## 🧯 Backup & Disaster Recovery

- DynamoDB point-in-time recovery (PITR)
- S3 versioned artifacts
- Stateless compute allows fast redeployment
- Infrastructure reproducible via pipeline

---

## 📊 Observability & Debugging

Yard is observable by default:

- Lambda execution logs
- API latency tracking
- Error rate alarms
- DynamoDB throttling alerts

This ensures **fast detection and resolution** of production issues.

---

## 📚 Case Study Summary

**Problem:**  
Users struggle with property discovery due to app friction and poor mobile UX.

**Solution:**  
Move property discovery to WhatsApp using AI-driven search and conversation memory.

**Challenges:**

- Natural language ambiguity
- Message duplication from WhatsApp webhooks
- Maintaining context across conversations

**Solutions:**

- LLM-powered intent extraction
- DynamoDB-based idempotency checks
- Time-bound search memory

**Learnings:**

- Conversational UX drives higher engagement
- Serverless reduces operational complexity
- Observability is critical for chat-based systems

---

## 🔮 What I’d Improve at Scale

- Vector search for better semantic matching
- Multi-language support
- Advanced analytics dashboard
- CRM integrations for agents
- Fine-tuned LLM models

---

## 👨‍💻 Author

**Kenneth Akpo**  
Frontend & Cloud Engineer

- Specializes in **serverless systems**, **DevOps**, and **conversational platforms**
- Open to leading or joining forward-thinking PropTech teams

🔗 Let’s build the future of property discovery.

---

## 📜 License

MIT License
