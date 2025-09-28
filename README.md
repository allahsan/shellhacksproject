# TeamDock 🚀

<div align="center">

  **Breaking the Ice at Hackathons**

  [![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-Realtime-green?logo=supabase)](https://supabase.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
  [![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

  <p align="center">
    <strong>Built at ShellHack 2025</strong> |
    <a href="#demo">View Demo</a> •
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#getting-started">Get Started</a>
  </p>

</div>

---

## 🎯 Problem

Ever been to a hackathon and noticed talented individuals sitting alone, struggling to find teammates? The room is full of potential, but lacking connections. Ideas remain unbuilt, not due to lack of skill, but lack of team formation.

## 💡 Solution

**TeamDock** is a real-time team formation and collaboration platform designed specifically for hackathons. It transforms awkward introductions into seamless connections, helping hackers find their perfect team based on skills, interests, and project ideas.

## ✨ Features

### 🔍 **Smart Team Discovery**
- Browse teams by tech stack, project ideas, and required skills
- Filter by team status (recruiting, full, in-progress)
- See team statistics and member composition at a glance

### 👤 **Skill-Based Profiles**
- Highlight your expertise (Frontend, Backend, ML/AI, Design, etc.)
- Set your availability status
- Showcase your hackathon goals

### 📢 **Real-Time Team Feed**
- Share updates, milestones, and achievements
- React and comment on team posts
- Stay connected with all teams' progress

### 👥 **Team Management Dashboard**
- **For Leaders**: Manage join requests, set team requirements
- **For Members**: View team info, collaborate on posts
- **Smart Notifications**: Never miss important updates

### 📊 **Live Activity & Statistics**
- Real-time hackathon statistics
- Skill supply/demand analysis
- Team formation trends
- Activity heatmaps

### 🔒 **Simple & Secure Authentication**
- No complex passwords - use memorable secret codes
- Quick signup with essential info only
- Secure SHA256 hashing for all credentials

### 📱 **Mobile-First Design**
- Fully responsive interface
- Touch-optimized interactions
- Works on any device

## 🛠 Tech Stack

<table>
<tr>
<td>

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **State**: React Query
- **Forms**: React Hook Form

</td>
<td>

### Backend
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime
- **Auth**: Custom RPC with Supabase
- **Functions**: PostgreSQL RPC
- **Hosting**: Vercel
- **File Storage**: Supabase Storage

</td>
</tr>
</table>

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/allahsan/hackathontest.git
cd hackathontest
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

4. **Set up the database**
```bash
# Run the schema file in your Supabase SQL editor
# Location: plans/database_schema.sql
```

5. **Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 📁 Project Structure

```
teamdock/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── god-mode/          # Admin dashboard
│   ├── manage-team/       # Team management
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── TeamFeed.tsx      # Real-time feed
│   ├── TeamDashboard.tsx # Team management
│   ├── AuthModal.tsx     # Authentication
│   └── ...
├── lib/                   # Utilities and configs
│   └── supabase/         # Supabase client
├── types/                 # TypeScript definitions
├── plans/                 # Database schemas
└── public/               # Static assets
```

## 🎯 Key Features Implementation

### Real-Time Updates
```typescript
// Subscribing to team updates
const subscription = supabase
  .channel('team-updates')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'team_posts'
  }, handleRealtimeUpdate)
  .subscribe()
```

### Secure Authentication
```typescript
// Simple secret code authentication
const { data, error } = await supabase.rpc('login_with_secret', {
  p_identifier: email_or_phone,
  p_secret_code: secret_code
})
```

### Team Management
```typescript
// Create a new team
const { data, error } = await supabase.rpc('create_team', {
  p_team_name: name,
  p_description: description,
  p_tech_stack: techStack,
  p_looking_for_roles: roles
})
```

## 🔧 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:pull      # Pull database schema
```

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🐛 Known Issues

- Team leave functionality needs hash comparison fix
- Some RPC function names need alignment
- Notification system UI pending implementation

See [gap_analysis.md](gap_analysis.md) for detailed technical debt.

## 📈 Future Enhancements

- **Discord Integration**: Direct team chat channels
- **GitHub Integration**: Automatic repo creation
- **AI Matching**: Smart team recommendations
- **Video Chat**: Built-in team meetings
- **Mobile Apps**: Native iOS/Android apps
- **Analytics Dashboard**: Advanced team insights

## 👥 Team

Built with ❤️ at **ShellHack 2024** by passionate developers who believe in the power of collaboration.

## 📜 License

This project is protected under a Proprietary License - see the [LICENSE](LICENSE) file for details.

**© 2024 TeamDock - All Rights Reserved**

This software is proprietary and confidential. Unauthorized copying, use, or distribution of this software is strictly prohibited.

## 🙏 Acknowledgments

- ShellHack organizers for the amazing hackathon
- Supabase team for the excellent real-time infrastructure
- All the solo hackers who inspired this solution
- The open-source community for amazing tools and libraries

## 📞 Support

Having issues? We're here to help!
- Open an [issue](https://github.com/allahsan/hackathontest/issues)
- Check our [documentation](docs/)
- Contact the team

---

<div align="center">

  **Made for Hackers, by Hackers**

  If TeamDock helped you find your dream team, give us a ⭐!

  [Live Demo](#) | [DevPost](https://devpost.com) | [Report Bug](https://github.com/allahsan/hackathontest/issues)

</div>