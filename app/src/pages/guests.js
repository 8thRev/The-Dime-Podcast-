import Head from 'next/head';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';

const GUESTS_TICKER = [
  'Aubrey Amatelli', 'Gretchen Gailey', 'Dan McDermitt', 'Margaret Brodie',
  'Micah Anderson', 'Kristin & Eric Rogers', 'Trent Woloveck', 'John Shute',
  'Brian Adams', 'Nicolas Guarino', 'Bill Morachnick', 'Ryan Crandall',
  'Tyler Robson', 'Adam Stettner', 'Chris Emerson', 'Nick Kenny',
  'Thomas Winstanley', 'Alex Kwon', 'Jared Maloof', 'Chris Ball',
  'Jim Higdon', 'Ryan Castle', 'Mitchell Osak', 'Zach Edge',
  'Dan Cook', 'Nadia Sabeh', 'David Fettner', 'Shahar Yamay',
  'Hirsh Jain', 'Socrates Rosenfeld', 'Jesse Redmond', 'Brett Puffenbarger',
  'Tyler Nielsen', 'Ilya Shmidt', 'Brett Gelfand', 'George DeNardo',
  'AnnaRae Grabstein', 'Emily Fisher & Dr June Chin', 'Christina Betancourt Johnson', 'Ron Gershoni',
  'Luna Stower', 'Nick Kovacevich', 'Jeff Guillot', 'Jamie Pearson',
  'Dan Shapiro', 'Trip McDermott', 'Chloe Kaleiokalani', 'Ben Burstein',
  'Ralph Risch', 'Colin Keeler', 'Wendy Bronfein', 'Jack Grover',
  'Kristian Andreassen', 'Yoko Miyashita', 'Cameron Clarke', 'Erik Knutson',
  'Sundie Seefried', 'Travis Higginbotham', 'Zach Marburger', 'Emily Sisneros',
  'Brandon Bobart', 'Mike Siebold', 'Rama Mayo', 'Alleh Lindquist',
  'Jordan Isenstadt', 'Neil Kaufman', 'Mario Naric', 'Krista Raymer',
  'Shane Johnson', 'Dr. Tassa Saldi', 'Chris Fontes', 'Anthony Coniglio',
  'Seth Yakatan', 'Todd Harrison', 'Rick Bashkoff', 'Gabe Mendoza',
  'Crystal Millican', 'Markel Bababekov', 'Bradley Nattrass', 'Charlie Bachtell',
  'Kate Miller', 'Dr. Matthew Moore', 'Warren Bobrow', 'Lulu Tsui',
  'Jon Levine', 'Jon Purow', 'Rob Sechrist', 'Harrison Bard',
  'Anne Forkutza', 'Jeremy Johnson', 'Dr. Amanda Reiman', 'Bob Hoban',
  'Matt Zorn', 'Kristi Palmer', 'Emma Beckerle', 'David Goubert',
  'Christine Smith', 'Ted Lidie', 'Christina Wong', 'Brandon Barksdale',
  'Lisa Buffo', 'Scott Grossman', 'Raj Grover', 'Rob Sims',
  'Ian Rumpp', 'Michael Johnson', 'Luke Anderson', 'Aaron Miles',
  'Alvaro Torres', 'John Yang', 'Jesse Campoamor', 'Elliot Lane',
  'Chad Bronstein', 'Kim Rivers', 'Jason Spatafora', 'Coleman Beale',
  'Olivia Alexander', 'Kristina Adduci', 'Max Simon', 'Adam Terry',
  'Jane West', 'Graham Farrar', 'Brady Cobb', 'Damian Fagon',
  'Kieve Huffman', 'Shaleen Title', 'Karson Humiston', 'Daniel Muller',
  'Chris Chiari', 'Chris Becker', 'Matt Hawkins', 'Nate Lipton',
  'Leslie Bocskor', 'Chris Piazza', 'Adam Young', 'Vince Ning',
  'Kim Stuck', 'Ashley Reynolds', 'Jason Wild', 'Emily Paxhia',
  'Josh Smith', 'Troy Datcher', 'Oren Schauble', 'Otha Smith',
  'Nathan Mison', 'Franny Tacy', 'Lisa Weser', 'Lauren Wilson',
  'Kaelan Castetter', 'Wes Campbell', 'Eric Levitt', 'Dede Perkins',
  'Dr. Tim Shu', 'Gary Santo', 'Nicolas Schlienz', 'Jeff Ragovin',
  'Robert Beasley', 'Rob Wirtz', 'Ben Larson', 'Tahir Johnson',
  'Ashley Grimes', 'Ben Euhus', 'Sam Richard', 'Rosie Mattio',
  'Jason Malcolm', 'Jordan Highley', 'Colin Landforce', 'Mona Zhang',
  'Dr. John Abrams', 'Dr. Jason Lupoi', 'Johanna Nuding', 'Fabian Monaco',
  'Josh Crossney', 'Neil Juneja', 'Jon Rubin', 'Jordan Zager',
  'Kevin Carrillo', 'Malcolm Boyce', 'Rena Sherbill', 'Bruce Eckfeldt',
];

export default function ForGuests() {
  return (
    <>
      <Head>
        <title>Apply to Guest - The Dime Podcast</title>
      </Head>
      <Header />

      <section style={{ padding: '80px 48px', borderBottom: '1px solid var(--faint)' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 16 }}>
          Guest Application
        </div>
        <h1 className="syne" style={{ fontSize: 'clamp(44px,7vw,92px)', fontWeight: 800, color: '#E8E4DC', letterSpacing: '.02em', lineHeight: 0.88, maxWidth: 760, marginBottom: 36 }}>
          This is the room<br />
          serious operators<br />
          <span style={{ color: '#00C9A7' }}>want to be in.</span>
        </h1>
        <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: '#7A8FA8', maxWidth: 600, fontWeight: 300 }}>
          The Dime listener is an operator, executive, or investor making real decisions in cannabis. They are not looking for inspiration. They are looking for intelligence. If you have something real to say to that room, this is where you say it.
        </p>
      </section>

      <section style={{ padding: '80px 48px', borderBottom: '1px solid var(--faint)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80 }}>
        <div>
          <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 20 }}>
            Who's Listening
          </div>
          {[
            ['Primary Audience', 'Cannabis operators, CEOs, founders, VPs, and strategic advisors across the full supply chain.'],
            ['Investors', 'Family offices, cannabis-focused funds, and institutional capital allocators.'],
            ['Credibility', '4.9 stars, 111 ratings, top 5% most shared globally. 299 episodes.'],
            ['Geography', 'NY, FL, MI, CA, CO, IL, MA and every emerging state market with capital at stake.'],
            ['Mindset', 'Survival-focused. Risk-aware. Skeptical of hype. Benchmarking against peers.'],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '22px 0', borderTop: '1px solid var(--faint)' }}>
              <div className="mono" style={{ fontSize: '9px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#00C9A7', marginBottom: 8 }}>
                {label}
              </div>
              <div className="crimson" style={{ fontSize: '15px', color: '#7A8FA8', lineHeight: 1.8, fontWeight: 300 }}>
                {value}
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 20 }}>
            What Works Here
          </div>
          <div style={{ borderLeft: '2px solid #00C9A7', paddingLeft: 28, marginBottom: 48 }}>
            <p className="crimson" style={{ fontSize: '15px', color: '#7A8FA8', lineHeight: 1.9, fontWeight: 300, marginBottom: 18 }}>
              This is not a brand awareness play. The guests who land well on The Dime bring something real: a hard decision they made, a structural insight, a contrarian view on where the market is going.
            </p>
            <p className="crimson" style={{ fontSize: '15px', color: '#7A8FA8', lineHeight: 1.9, fontWeight: 300 }}>
              We do not do puff pieces. We do not do product launches dressed as conversations. The room will notice, and it will cost you credibility, not build it.
            </p>
          </div>
          <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 16 }}>
            Past Guests Include
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {GUESTS_TICKER.slice(0, 16).map((g) => (
              <div key={g} style={{ fontSize: '12px', fontWeight: 500, color: '#3A4F66', padding: '12px 0', borderBottom: '1px solid var(--faint)', transition: 'color .15s', letterSpacing: '.02em' }}>
                {g}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '80px 48px' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 32 }}>
          Submit Your Application
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input placeholder="Full Name" style={{ background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', width: '100%', outline: 'none' }} />
            <input placeholder="Company and Title" style={{ background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', width: '100%', outline: 'none' }} />
            <input placeholder="Email Address" style={{ background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', width: '100%', outline: 'none' }} />
            <textarea placeholder="What would you say to a room of cannabis operators and executives? 2-3 sentences." rows={4} style={{ background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', width: '100%', outline: 'none', resize: 'vertical' }} />
            <textarea placeholder="Links: LinkedIn, recent press, company website" rows={2} style={{ background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', width: '100%', outline: 'none', resize: 'none' }} />
            <button className="btn-teal" style={{ alignSelf: 'flex-start' }}>
              Submit Application
            </button>
          </div>
          <div>
            <div className="mono" style={{ fontSize: '9px', color: '#009E85', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 20 }}>
              What Happens Next
            </div>
            {[
              ['Review', 'We review every application personally. If it\'s a fit, we\'ll reach out within 5 business days.'],
              ['Pre-Call', 'A short alignment call to agree on angle, framing, and what the room needs to hear from you.'],
              ['Recording', 'Remote or in-person. We handle all production. You show up with something real to say.'],
              ['Distribution', 'Apple Podcasts, Spotify, YouTube, LinkedIn, and the First Principles newsletter.'],
            ].map(([step, detail]) => (
              <div key={step} style={{ marginBottom: 28 }}>
                <div className="mono" style={{ fontSize: '9px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#00C9A7', marginBottom: 6 }}>
                  {step}
                </div>
                <div className="crimson" style={{ fontSize: '14px', color: '#7A8FA8', lineHeight: 1.82, fontWeight: 300 }}>
                  {detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
