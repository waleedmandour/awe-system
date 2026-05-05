import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Types
export interface Course {
  id: string;
  code: string;
  name: string;
  program: 'foundation' | 'post-foundation';
  description?: string;
}

export interface Criterion {
  id: string;
  name: string;
  maxScore: number;
  description?: string;
}

export interface Score {
  criterionId: string;
  criterionName: string;
  score: number;
  maxScore: number;
  feedback?: string;
}

export interface Assessment {
  id: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  overallFeedback?: string;
  scores: Score[];
  wordCount?: number;
  targetWordCount?: { min: number; max: number; ideal: number } | null;
  createdAt: string;
}

export interface Essay {
  id: string;
  studentId?: string;
  studentName?: string;
  originalText: string;
  editedText?: string;
  imageData?: string;
  topic?: string;
  wordCount: number;
  status: 'pending' | 'processing' | 'assessed' | 'error';
  courseId: string;
  assessment?: Assessment;
  createdAt: string;
}

export type ExamType = 'mid-semester' | 'final' | null;
export type WritingType = 'summary' | 'synthesis' | null;
export type PracticeType = 'mid-semester' | 'final' | null;
export type AppStep = 'welcome' | 'setup' | 'course' | 'upload' | 'processing' | 'review' | 'assessing' | 'results' | 'records';

// Summary writing source texts for LANC2160
export interface SummarySourceText {
  id: string;
  title: string;
  originalText: string;
  wordCount: number;
  // Target summary length is ~1/3 of original
  targetMin: number;
  targetMax: number;
  targetIdeal: number;
}

export const SUMMARY_SOURCE_TEXTS: SummarySourceText[] = [
  {
    id: 'salmon-cannon',
    title: 'The "Salmon Cannon" is the Latest Method for Transporting Fish over Dams',
    originalText: `While hydroelectric dams are able to generate electricity without coal or oil, they act as obstacles for wildlife, and migrating salmon in particular. When salmon are ready to reproduce, they migrate from the sea back upstream into rivers, where they spawn on gravel beds. Swimming upstream requires the ability to fight against obstacles including rapids and up over drop-offs. Yet no matter how well salmon swim, these manmade barriers are often too massive for the fish to cross on their own.

Typically, dams have manmade fish ladders to help fish swim upstream. Water flows over a series of steps, and the determined fish leap up repeatedly, climbing up the steps until they exit into the river at the top of the dam. Unfortunately, at a certain point, some dams are too high and ladders aren't a practical solution. In addition, fish may turn around if the water in a fish ladder is too warm.

Wildlife departments and public utilities already do impractical things to divert salmon past manmade barriers. These include putting them on trucks, loading them onto barges, and in a few cases, lifting them by helicopter. However, the aptly-named company Whooshh Innovations was inspired to solve this problem by looking at their own existing technology invented to transport delicate produce, like ripe tomatoes or apples. The Whooshh system sucks up produce through pressurized tubes and transfers them onto trucks without damage.

If Whooshh tubes could send apples flying over long distances without damaging them, maybe, an employee thought, they could suck fish up and over the dams blocking a river. \"So we put a tilapia in the fruit tube,\" Whooshh's VP Todd Deligan said. \"It went flying, and we were like, 'Huh, check that out.'\" They were able to modify their system to safely give fish a boost, and thus, the salmon cannon was born.

Though the name \"cannon\" is catchy, the device doesn't actually operate like one. Instead, it acts a little like a vacuum cleaner. As a fish enters the system, it immediately whizzes up the tube because the pressure in front of it is lower than the pressure behind it. This differential pressure generates a seal around the fish's middle, holding it steady as the fish speeds along. As the seal lets go of the fish toward the tube's end, the fish slows down. Friction, gravity, and increased water help it decelerate too as it is released into the water.

It took a few years to tweak the design, but Whooshh has developed a system that enables salmon and trout to easily load themselves into the device. The company has also developed a scanner that can automatically sort fish to prevent unwanted species or other objects from travelling through the system. The fish can travel at a speed of 24-35 km/h (15-22 mph) along a track that is misted in order to keep them wet throughout the journey. The current system can transport up to 40 fish per minute.

The tube doesn't appear to increase short-term stress on the fish, according to a 2013 U.S. Geological Survey study, published in the North American Journal of Fisheries Management, that examined the fishes' cortisol levels. Deligan also points out that the cannon speeds up the fish's journey and saves them energy. \"That should translate to a higher return rate of the fish at the spawning grounds,\" he said. So far, Whooshh's cannons have been installed to help fish navigate dams on several rivers in Washington and Oregon. The company hopes that, with continued success, it can expand its business to assist spawning fish in rivers around the globe.`,
    wordCount: 613,
    targetMin: 160,
    targetMax: 220,
    targetIdeal: 200,
  },
];

// Synthesis essay assignment interface (multiple source texts)
export interface SynthesisAssignment {
  id: string;
  title: string;
  description: string;
  cefrLevel: string;
  expectedParagraphs: number;
  sources: {
    id: string;
    title: string;
    content: string;
  }[];
  targetWordCount: {
    min: number;
    max: number;
    ideal: number;
  };
}

export const SYNTHESIS_ASSIGNMENTS: SynthesisAssignment[] = [
  {
    id: 'nitrates-poisoning',
    title: 'Two Common Sources of Poisoning Nitrates',
    description: 'Write a synthesis essay (4 paragraphs) based on three source texts about nitrates and their effects on human health. Synthesize information from all three sources to explain two common sources of nitrate poisoning: contaminated well water and contaminated vegetables.',
    cefrLevel: 'A2-B1',
    expectedParagraphs: 4,
    targetWordCount: {
      min: 200,
      max: 300,
      ideal: 250,
    },
    sources: [
      {
        id: 'source-1-nitrates',
        title: 'What are Nitrates?',
        content: `Nitrates (NO3) are chemical compounds made from nitrogen (N) and oxygen (O). The primary toxic effects of the inorganic nitrate ion (NO3) result from its reduction to nitrite (NO2) by microorganisms in the upper digestive tract. The gastrointestinal tract of adults can process this chemical and it naturally passes out of the body through urine, but it can cause a dangerous blood condition in children. High levels of nitrate in food or drinking water are known to be dangerous to babies in the first three months of life, and may result in the so-called "blue baby syndrome". The chemical causes the blood to carry less oxygen, and the infant may suffocate. Other symptoms of nitrite toxicity in children and adults can include difficulty in breathing, dizziness, headaches, nausea, and vomiting. In older children and adults, there is also a risk of cancer because nitrites are unstable and can combine readily with other compound to form nitrosamines, which can cause cancer.`,
      },
      {
        id: 'source-2-well-water',
        title: 'Well Water May Be a Common Source of Nitrate Poisoning',
        content: `A recent study in the U.S. has said that families using water from wells in agricultural areas should have their water tested regularly to check nitrate levels. The U.S. Safe Drinking Water Act of 1974 established that the maximum safe concentration of nitrates in drinking water is 10 mg/l. Yet some wells tested during the study showed levels that were considerably above that limit. Nitrites can build up in groundwater as a result of the excessive use on farms of nitrogen-based fertilizers such as potassium nitrate and ammonium nitrate. These chemicals often seep into well water and accumulate there. If wells are found to have nitrate levels that are above the safe limit, it is not advisable to use that water for drinking.`,
      },
      {
        id: 'source-3-vegetables',
        title: 'Increased Nitrate Levels Found in Vegetables',
        content: `Nitrates are the main form in which the essential plant nutrient, nitrogen, is absorbed naturally by plants from the soil. When fertilizers are added to the soil, the plants can use the nitrates directly and this increases plant growth. Most of the excess nitrates in the environment originate from the chemical fertilizers that are manufactured for agriculture. Unfortunately, in their search for greater profits, farmers often overuse nitrate-based chemical fertilizers to improve crop yields. Vegetables become contaminated with nitrates when crops take up more than they can use for growth. As a consequence, nitrate levels in carrots, lettuce, and spinach, for example, have roughly doubled since the 1970s in the US.`,
      },
    ],
  },
  {
    id: 'xeros-washing-machine',
    title: 'Two Advantages of the Xeros Waterless Washing Machine',
    description: 'Write a synthesis essay (4 paragraphs) based on three source texts about the Xeros waterless washing machine. Synthesize information from all three sources to explain two advantages of the Xeros machine over conventional washing machines.',
    cefrLevel: 'A2-B1',
    expectedParagraphs: 4,
    targetWordCount: {
      min: 300,
      max: 350,
      ideal: 325,
    },
    sources: [
      {
        id: 'source-1-xeros-tech',
        title: 'The Xeros Washing Machine: Cleaning with Nylon Beads Instead of Water',
        content: `Laundry, washing clothes, consumes a large amount of water and energy. The process also produces large amounts of waste water. A UK company, Xeros Ltd., has developed a new kind of washing machine that uses 90% less water to clean clothes. Instead of water, the machine uses a large quantity of nylon beads. These beads are about 3mm long, and look something like grains of rice. The beads, which can be reused hundreds of times, absorb the dirt and stains in clothes.
The idea for this technology came from Stephen Burkinshaw, a chemist at Leeds University who spent 30 years working out how to improve the dyeing of plastics used in fabrics. A few years ago he realized that the stains on clothes acted in a similar way to dyes, and he wondered if he could use plastics to attract away the stains.
He experimented with many kinds of polymers before finding that nylon beads or chips work very well as stain collectors. A natural property of nylon makes it attract to its surface the particles that make up stains. In an environment of 100% humidity, the polymer chains in the nylon beads separate slightly. This makes them super absorbent. The stain particles are then sucked into the centers of the beads.
Working with Xeros Ltd., Burkinshaw developed a washing machine based on his technology. The washing machine looks like a conventional washer. The clothes are placed in the washing compartment and the door is closed. The machine then adds a tiny amount of detergent to help separate dirt from the clothes and a small quantity of water, (360 ml for a commercial machine) to increase humidity. At the same time, several kilograms of nylon beads are released into the washing compartment. The drum rotates, and the beads flow over the laundry for some time. The beads absorb stains and dirt, along with the detergent, as they bounce and rub against the clothes. When the cycle has ended, the machine extracts the beads to be reused. Approximately 99.95% of the beads are removed. The clothes are then removed from the machine and the few remaining beads are shaken or vacuumed off. Clothes are almost completely dry when they come out of the machine. The nylon beads can be reused hundreds of times before they must be replaced. Used beads can then be recycled.
The Xeros washing machine is not yet available to consumers. In the beginning, it will be used in commercial laundries rather than in the home. The first machines should be in use by the end of 2021. 50% of the running costs of commercial laundries comes from water and waste water, and energy costs make up another 30%. Since the Xeros machines use much less water and energy, they should be much cheaper to operate.
People around the world have been washing their clothes in water for thousands of years. The Xeros waterless washing machine has the potential to change that, and thus save huge amounts of water and energy. It is truly a revolutionary product.`,
      },
      {
        id: 'source-2-xeros-environment',
        title: 'The Environmental Impact of Laundry',
        content: `It takes a lot of water and energy to clean clothes, so the laundry process has a huge environmental impact. Many parts of the world have a shortage of water. This situation is getting worse as human populations increase. Laundry uses a significant part of the available water supply. Even the most efficient commercial washing machines use more than 18 liters of water per kilogram of clothes. In the U.S., more than 18 million cubic meters of water are used for laundry every day. This means more groundwater has to be pumped and more dams have to be constructed. Finally, almost all the water that is used for cleaning clothes is then released as waste water, which requires expensive processing.
Laundry uses energy. First of all, energy is used to produce and purify the water. This is particularly true in places that desalinate ocean water. In addition, approximately 70% of the water used in a commercial laundry is heated, much of it to over 60 degrees C. That requires a lot of energy. A laundry that processes 2000 kg per day would use 36,000 liters. Heating 70% of that amount means heating over 25,000 liters of water. This requires a large amount of energy, and since most energy is produced from fossil fuels, washing clothes releases a large amount of CO2 into the atmosphere. Most laundries and many homes (over 80% in the U.S.) use clothes dryers in addition to washing machines. These use a very high amount of energy, which of course releases large quantities of CO2.
A complex chemical engineering process is required to produce the detergents used in washing machines. These are made up in large part of hydrocarbons which come from oil, although many other chemicals are added to make them effective. A significant amount of energy is needed for these processes. Detergents must also be chemically broken down when, after use, they are released into waste water treatment facilities.
Overall, cleaning clothes uses a large amount of resources and has a significant effect on the environment. A family which washes and dries a load of laundry every two days creates around 440kg of CO2 each year and uses thousands of liters of water. Significant reductions in this consumption could have a very positive effect on the planet.
Since the Xeros does not require a rinse or spin cycle it uses just 2% of the water and energy of conventional washing machines, cutting CO2 emissions on top of the water savings. The energy savings are further increased by the fact that the clothes come out nearly dry, meaning no power-hungry clothes dryer is required. Xeros claims that, taking all these factors into account, its machine achieves a 40% reduction in carbon emissions over conventional washing and drying.`,
      },
      {
        id: 'source-3-xeros-cost',
        title: 'Cost Comparison for a New Commercial Laundry',
        content: `The Xeros waterless technology will not be available for home use for some years. The machines will first be tested in commercial laundry businesses. Below is a general comparison of probable costs for a new laundry business (Table).

Costs: Conventional Machines / Costs: Xeros

First cost: washing machines lower than Xeros / higher than conventional
dryers: high / none

Operating costs:
water (water to wash clothes): high / 90% lower than conventional
waste water (water that has been used to clean clothes and must be removed): high / 90% lower than conventional
electricity / gas: high: must heat washing water and must operate clothes dryers / much lower; no water heating, shorter washing cycles, no dryers
detergents: high / low: much less detergent is used
plastic beads: none / important cost; necessary for operation but beads can be reused many times

machine maintenance: some cost / similar technology to conventional washers, so similar cost but no dryer maintenance

Overall costs: higher / 30% lower than conventional`,
      },
    ],
  },
  {
    id: 'co2-automobile-ac',
    title: 'Two Advantages of CO2 for Automobile Air Conditioning Systems',
    description: 'Write a synthesis essay (4 paragraphs) based on three source texts about CO2 as a refrigerant for automobile air conditioning systems. Synthesize information from all three sources to explain two advantages of CO2 for automobile air conditioning systems.',
    cefrLevel: 'A2-B1',
    expectedParagraphs: 4,
    targetWordCount: {
      min: 300,
      max: 350,
      ideal: 325,
    },
    sources: [
      {
        id: 'source-1-co2-cool-wars',
        title: 'The Cool Wars',
        content: `Mechanical refrigeration systems were developed in the late 19th and early 20th centuries. These systems were based on the compression and evaporation of gases. The primary refrigerants (gases used in cooling systems) were ammonia (NH3), sulfur dioxide (SO2) and chloromethane (Ch3Cl). These worked relatively well, but were not suitable for home use because they are toxic.
In the late 1920s, Thomas Midgley developed chlorofluorocarbons (CFCs), which the DuPont Chemical Company marketed as Freon, for use as refrigerants. These compounds of carbon, chlorine and fluorine have many useful properties. They are non-toxic, non-flammable, non-reactive, inexpensive, and efficient as refrigerants. From the 1930s, CFCs were produced in huge quantities for use in refrigeration. Soon, CFCs were used in other applications, such as air conditioning (AC) systems, fire extinguishers and spray cans.
However, in the early 1970s, scientists noticed that CFCs can reach the upper atmosphere. There, the molecules are broken apart by ultraviolet light from the sun, which results in a chemical reaction that breaks down the ozone molecule. Ozone in the upper atmosphere is important because it absorbs some of the ultraviolet radiation coming from the sun. When the ozone decreases, more ultraviolet radiation reaches the earth. Too much ultraviolet radiation can cause increased skin cancer and eye damage in humans.
Governments from around the world met in the 1980s and adopted the Montreal Protocol. This was an agreement to stop the production and use of CFCs and other compounds that damage the ozone layer.
It has not been easy to find a good replacement refrigerant that does not damage the ozone layer and does not contribute to global warming. The necessary properties for a suitable replacement gas include the following: low Ozone Depletion Potential (ODP), low Global Warming Potential (GWP), non-toxic, non-flammable, efficient refrigerant, inexpensive and easy to produce.
Just as in the 19th century electrical Current Wars, we now have the Cool Wars. The race is on to produce refrigeration and air conditioning systems that do not endanger the ozone layer and do not contribute to global warming. Currently, the two strongest choices for a new refrigerant gas are CO2 and HFO-1234yf (C3H2F4). The winners of the Cool Wars will make billions of dollars.

Refrigerant | History | ODP | GWP
CFC-12 | Most commonly used refrigerant before Montreal Protocol | 1 | 10,890
HFC-134a | First generation replacement for CFC-12 | 0 | 1300
CO2 | Possible non-hydrocarbon replacement for HFC-134a | 0 | 1
HFO-1234yf | Possible hydrocarbon-based replacement for HFC-134a | 0 | 4

NOTE: This chart compares the effect of each refrigerant on the ozone and on global warming. For example, one molecule of CFC-12 has 10,890 times more effect on Global Warming than one molecule of CO2.`,
      },
      {
        id: 'source-2-co2-safety',
        title: 'The Safety of Refrigerants Used in Automobile Air Conditioning Systems',
        content: `One of the main concerns for automobile engineers and government regulators is passenger safety. The main safety concerns about car AC refrigerants are flammability and toxicity.
While carbon dioxide is non-flammable, many other gases which could be used as refrigerants ignite under certain conditions. For example, butane and propane, which are commonly used as fuel in domestic gas cookers, have properties that would make them efficient gases for use in refrigeration systems. They are, however, both explosive and toxic, so governments have banned their use in automobile air conditioners.
The new DuPont compound HFO-1234yf is flammable. However, DuPont says it is only slightly flammable and does not ignite at most temperatures that could be encountered. Independent tests have shown that in case of a front-end accident, air conditioning systems using HFO-1234yf would significantly increase the risk of fire. Additional safety measures would thus be necessary to reduce this risk. This would have a negative impact on the system's efficiency, while increasing its costs at the same time.
Carbon dioxide also can have harmful effects on the human body if inhaled in sufficient quantities. If the concentration of CO2 reaches 3%, a person's respiration rate will increase by 100%. People with heart conditions could be at risk. This has been a concern to engineers and governments. However, the total amount of CO2 in a car AC system is very small (less than 500 grams). This is not enough to harm a person, even if the total amount was released at one time, and tests have shown that a leak of gas from a CO2 car AC system would probably not be very large.
Information about the toxicity of HFO-1234yf is not known. Two years after the introduction of this compound, the DuPont company has not released the results of their toxicity tests.`,
      },
      {
        id: 'source-3-co2-cost',
        title: 'How Much Will it Cost?',
        content: `The Cool Wars may, in the end, be won or lost over the issue of cost. Different participants in the competition have different cost concerns. The chemical industry, led by DuPont, wants to produce and sell a new synthetic refrigerant for many years to come. The automotive industry does not want the increased costs of developing and manufacturing new AC systems. On the other hand, many companies want to develop a new technology that they will be able to produce and sell in the future. Consumers do not want to spend extra money when buying a new car, and they also want to have lower costs over the life of their vehicle. Finally, governments do not want to pay for the costs that could result from the effects of global warming. Below is a chart that summarizes some of the costs involved:

Refrigerant | Production cost (OMR/ton) | Extra cost for new system design | AC system service cost | Lifetime energy use of AC equipped car (varies depending on climate)
HFC-134a | 2.5 | None; currently exists | High recharge cost; expensive special equipment needed to collect and recycle refrigerant at the end of system service life | —
CO2 | 0.25 | About 10 rials per car; high pressure system components must be designed and produced | Low recharge cost; expensive special equipment needed to deal with the very high pressures needed for CO2 to function as an effective refrigerant | More fuel efficient than HFC-134a systems; thus lower fuel consumption for the vehicle
HFO-1234yf | 25 | None; uses existing HFC-134a systems | Very high recharge cost; expensive special equipment needed to collect and recycle refrigerant at the end of system service life | AC system 10-15% lower than HFC-134a systems; thus increased overall fuel use for the vehicle`,
      },
    ],
  },
];

// LANC1070 practice test interface (single source text, 4-paragraph essay)
export interface PracticeTest {
  id: string;
  title: string;
  description: string;
  cefrLevel: string;
  expectedParagraphs: number;
  sourceText: {
    id: string;
    title: string;
    content: string;
  };
  targetWordCount: {
    min: number;
    max: number;
    ideal: number;
  };
  practiceType: 'mid-semester' | 'final';
}

export const LANC1070_PRACTICE_TESTS: PracticeTest[] = [
  {
    id: 'lanc1070-p1-job-market',
    title: 'Opportunities and Challenges in Today\'s Job Market',
    description: 'Discuss the opportunities and challenges facing today\'s job market in terms of utilization of 21st century skills. Write a 4-paragraph synthesis essay based on the source text.',
    cefrLevel: 'A2-B1',
    expectedParagraphs: 4,
    practiceType: 'final',
    targetWordCount: { min: 300, max: 350, ideal: 325 },
    sourceText: {
      id: 'lanc1070-p1-source',
      title: '21st Century Skills in the Modern Job Market',
      content: `The modern job market is a complex environment shaped by various factors that significantly affect the skills needed for today's employment. Among these are technological advances, globalization, and the ever-changing nature of society, shaping the essential skill sets necessary for success in today's workforce.
Technology has become an important aspect across different professions in today's world. Proficiency in technology isn't just advantageous; it's a requirement for many jobs across various industries. For example, expertise in coding, data analysis, and using digital tools has become fundamental in fields like healthcare, finance, and information technology. In healthcare, professionals increasingly depend on digital records and diagnostic software, changing patient care approaches. This digital transformation has made patient data management more efficient and enhanced the ability to diagnose illnesses in patients.
Being able to adapt quickly and learn new skills is crucial in today's job market. Given the rapid pace of change, adaptability and a willingness to learn are key to success. Individuals who excel in continuously acquiring new skills often do well in professions where this adaptability is essential. For instance, imagine a marketing professional moving from traditional advertising methods to effectively using digital marketing strategies in response to changing consumer behaviors and market trends. This change allows for better customer engagement and business success in a rapidly changing environment.
Alongside technical skills, soft skills such as effective communication, problem-solving, and teamwork are crucial in the contemporary workforce. Employers highly value individuals who demonstrate strong collaborative skills and problem-solving abilities, essential for teamwork and problem-solving situations in today's workplaces. Effective communication ensures a smooth working environment and boosts innovation and productivity.
However, despite many opportunities, the job market also presents significant challenges. Technological advancements often mean traditional job roles are no longer needed, demanding the acquisition of new skills. Individuals in manufacturing, for instance, might need to learn to operate advanced machinery due to industry transformations. Similarly, the retail sector's shift towards e-commerce demands professionals to learn digital retailing skills to stay relevant.
Furthermore, accessibility and affordability of quality education and skill development programs present significant challenges. Financial limitations often prevent individuals from gaining new skills necessary for better job prospects. Collaborative efforts among government bodies, educational institutions, and businesses are crucial to ensure equal access to skill-building opportunities.
Let's consider "GulfTech Innovations," an imaginative technology company in Oman that uses 21st-century skills within its operational framework. Employees at GulfTech are empowered to take part in cross-disciplinary projects where creative thinking and problem-solving abilities are at the forefront. For instance, their software development team does not just focus on coding; they actively participate in design thinking workshops, allowing them to think critically and innovate while developing user-friendly software solutions for local industries. This collaborative approach creates a culture of continuous learning and adaptability, positioning GulfTech as an innovative leader in Oman's tech industry. Their commitment to developing these skills is evident in how they utilize modern technology to address local market demands, while constantly adapting to changing trends and needs.
In conclusion, today's job market presents diverse opportunities and complex challenges. Succeeding in this environment requires technical proficiency, adaptability, and strong soft skills. Continuous learning and adaptability are essential for success in today's multifaceted job market. Committing to lifelong learning and adapting to changing job requirements are essential for career success.`,
    },
  },
  {
    id: 'lanc1070-p2-monopoly',
    title: 'Advantages and Disadvantages of Monopoly',
    description: 'Discuss the advantages and disadvantages of monopoly. Write a 4-paragraph synthesis essay based on the source text.',
    cefrLevel: 'A2-B1',
    expectedParagraphs: 4,
    practiceType: 'final',
    targetWordCount: { min: 300, max: 350, ideal: 325 },
    sourceText: {
      id: 'lanc1070-p2-source',
      title: 'Monopoly: Advantages and Disadvantages',
      content: `A monopoly is a market structure with only one seller of a particular good or service serving many buyers. One of the characteristics of a monopoly is that there is no competition because there is only one single seller in the market. The seller, for example, companies or businesses that control the prices of that particular product or service and dominate the market, is called a monopolist. Unlike in perfectly competitive markets, monopolists control market supply and prices. The monopolist is either a company with a pure monopoly (100%) or one with a monopolistic power (greater than 25%).
There are multiple problems with monopolies. Monopolies are pricier. Because there is no competition, prices may rise. For instance, Microsoft commanded a high price for Microsoft Office throughout the 1980s when it controlled the market for PC software. As a result, consumers pay greater prices and have less available spending money. Besides, lack of competition may encourage organizational slackness and other forms of inefficiency. It is possible for a big firm to become inefficient because it is more difficult to coordinate and communicate in a big organization.
In addition, monopolies frequently possess the authority to pay suppliers less. For instance, farmers have criticized the dominance of big supermarkets, which results in them receiving very little for their goods. A monopoly may also be able to control the wages that its employees get. Companies with monopolies hold power to control the whole market. As a result, they are unable to focus much on the internal welfare of their workforce. They might be persuaded to approach their staff with a low-wage offer.
The undue political advantage is the next disadvantage of monopolies. Particularly with large IT giants that have such sway over society and people's choices, monopolies can amass political power and the capacity to reshape society in an undemocratic and unaccountable manner. Facebook, Google, and Twitter's influence on how information spreads through society is a rising source of worry. Large monopolists like Standard Oil developed a bad reputation in the late nineteenth century for abusing their power and driving competitors out of business.
The most common attribute of a monopoly market is customer exploitation. There aren't any alternatives, which means that the consumer is treated unfairly in terms of availability, value, and cost. Since there are no competing products for the already existing market, the company may find it simple to produce inferior or substandard goods if it so chooses. After all, they are confident that the goods will be purchased.
It's not all bad news, either. The merits of a monopoly are tremendous. Firstly, it is cheap to run. Since there are no near substitutes for the items in question because of their unique nature, the monopolist corporation can differentiate its products without incurring significant marketing and advertising expenses. Furthermore, a single firm can reduce its long-term average expenses in a sector with high fixed costs using economies of scale. For instance, it would be absurd to have numerous small businesses delivering tap water because they would be duplicating infrastructure and financial resources. Having a large-scale infrastructure makes it more effective to have just one firm. Indeed, some services are effectively and efficiently provided by monopolies. It is best to monopolize some services, such as those that are sensitive or security-related, to protect any potentially sensitive information and to preserve its confidentiality.
Additionally, monopoly-holding companies may be the most effective and dynamic. By outperforming their competitors, businesses might acquire monopoly power. For instance, Google has a monopoly on search engines, yet can we conclude that Google is a wasteful company that doesn't try to innovate? It has made significant investments in emerging technologies.
While monopolies can potentially provide improved quality and innovative products, as well as lower costs, it all depends on the choices that they make. They may instead exploit customers with higher prices and falling quantity, along with a limited choice of products.`,
    },
  },
  {
    id: 'lanc1070-p3-marketing',
    title: 'Traditional and Digital Marketing Strategies',
    description: 'Discuss traditional and digital marketing strategies. Write a 4-paragraph synthesis essay based on the source text.',
    cefrLevel: 'A2-B1',
    expectedParagraphs: 4,
    practiceType: 'final',
    targetWordCount: { min: 300, max: 350, ideal: 325 },
    sourceText: {
      id: 'lanc1070-p3-source',
      title: 'Marketing Strategies: Traditional and Digital',
      content: `Marketing refers to the activities a company undertakes to promote the buying or selling of its products or services. Marketing includes advertising and allows businesses to sell products and services to consumers, other businesses, and organizations.
Professionals who work in a corporation's marketing and promotion departments seek to get the attention of key potential audiences through advertising. Promotions are targeted to certain audiences and may involve celebrity endorsements, catchy phrases or slogans, memorable packaging or graphic designs, and overall media exposure. At its most basic level, marketing seeks to match a company's products and services to customers who want access to those products. Matching products to customers ultimately ensures profitability.
Types of Marketing Strategies
Marketing is comprised of an incredibly broad and diverse set of strategies. Though traditional marketing is still prevalent, digital marketing now allows companies to engage in newsletter, social media and content marketing strategies.
Before technology and the Internet revolutionized marketing practices, traditional marketing was the cornerstone of companies' efforts to reach consumers. This encompassed a diverse array of strategies tailored to engage different audiences. Outdoor marketing utilized public displays such as billboards, bench advertisements, vehicle wraps, and transit ads to capture attention in high-traffic areas. Print marketing, characterized by easily replicable materials, was often mass-produced with standardized content, though advancements in printing technology now offer greater flexibility. Direct marketing involved personalized content delivery through mail or distribution of coupons, vouchers, and pamphlets, aiming to establish direct communication with potential customers. Electronic marketing leveraged television and radio to deliver concise digital content, exploiting visual and auditory media to captivate audiences effectively. Event marketing aimed to gather prospective customers in specific locations for product demonstrations or discussions, leveraging conferences, trade shows, seminars, roadshows, and private events as platforms for engagement.
However, nowadays, the introduction of digital marketing has revolutionized the marketing industry, offering innovative ways for companies to connect with customers. Search Engine Marketing involves increasing search traffic through paid placements on result pages or emphasizing search engine optimization (SEO) techniques for organic visibility. E-mail Marketing relies on distributing messages or newsletters to customer email addresses, offering coupons, discounts, or advance sale notices. Social Media Marketing focuses on building an online presence on platforms through paid advertisements or organic growth strategies like posting content and interacting with followers. Content Marketing involves creating free content such as eBooks, infographics, or videos to share information about products, gather customer data, and foster long-term engagement with the company.`,
    },
  },
];

// LANC2146 practice test interface (lab report discussion & conclusion, A2-B1 level)
export interface Lanc2146PracticeTest {
  id: string;
  title: string;
  description: string;
  cefrLevel: string;
  expectedParagraphs: number;
  reportSections: {
    id: string;
    title: string;
    content: string;
  }[];
  resultsFigure?: {
    caption: string;
    imageUrl: string;
    graphDescription?: string;
  };
  targetWordCount: {
    min: number;
    max: number;
    ideal: number;
  };
  practiceType: 'mid-semester' | 'final';
}

export const LANC2146_PRACTICE_TESTS: Lanc2146PracticeTest[] = [
  {
    id: 'lanc2146-p1-seed-priming',
    title: 'Investigating the Effects of Seed Priming Germination on Wheat',
    description: 'Using the provided report sections (Abstract, Introduction, Methods and Materials, Results), write an appropriate Discussion and Conclusion for the report in 350-450 words total.',
    cefrLevel: 'A2-B1',
    expectedParagraphs: 6,
    practiceType: 'final',
    targetWordCount: { min: 350, max: 450, ideal: 400 },
    reportSections: [
      {
        id: 'lanc2146-p1-abstract',
        title: 'Abstract',
        content: `Seed priming is a technique used to control hydration in plants by treating seeds with Polyethylene Glycol (PEG), which stimulates rapid germination and enhances plant resistance to diseases and harsh environmental conditions. This treatment is an effective method for increasing crop production. The aim of this research was to investigate the effects of seed priming on wheat germination by applying different concentrations of PEG and measuring the radical length. The experiment was conducted in a laboratory setting, where seeds were treated with varying concentrations of PEG. Radical length was measured following germination. The results demonstrated the impact of four different PEG concentrations on the radical length of wheat. Based on these findings, several recommendations are provided for farmers, researchers, and policymakers to consider using seed priming as a strategy to enhance crop production.`,
      },
      {
        id: 'lanc2146-p1-introduction',
        title: 'Introduction',
        content: `Seed priming is a method of controlling hydration in plants by treating seeds with natural or synthetic compounds to induce metabolic activities for germination (Sheteiwy et al., 2015). Through seed priming, plants are able to activate defense responses to negative environmental conditions. Moreover, priming treatments lead to enhanced germination and result in larger crop yields (Salehzade et al., 2009). By contributing to growth speed and seedling uniformity, seed priming is seen as an efficient and beneficial way of ensuring crop establishment.

Treatment methods for seed priming include \u201chydropriming, biopriming, seed soaking, hormonal-priming, and magneto-priming\u201d (Salehzade et al., 2009). Polyethylene glycol (PEG) is often used in hydropriming due to its osmotic ability to affect dehydration in seeds and stimulate rapid germination and radical emergence, and stimulate crop establishment (Zhang et al., 2015). The aim of this study is to investigate the germination effects of seed priming on wheat (triticum aestivum) by quantifying radical length at various concentrations of PEG, test the hypotheses, and offer suggestions for implementation and future research. The initial hypothesis is that seeds primed with a moderate concentration of PEG will experience greater radical growth. A secondary hypothesis is that seeds primed with a higher concentration of PEG will suffer severe negative osmotic results and see less radical growth.`,
      },
      {
        id: 'lanc2146-p1-methods',
        title: 'Methods and Materials',
        content: `This study was conducted in a laboratory using a growth chamber, an electric balance, a Petri dish, filter paper, and a micropipette. All seeds were sterilized with a 2% Safex solution for 5 minutes, then rinsed with sterilized water and air dried at room temperature. The control group was separated and planted directly in the growth chamber. One group of seeds was primed with sterilized water and then relocated to the growth chamber. The remaining seeds were hydroprimed with Polyethylene Glycol (PEG) at various concentrations (5%, 10%, 15%, and 20%) for 12 hours. The hydro-primed seeds were then transferred to the growth chamber. Data was collected on radical length after germination. The results were tabled indicating concentration of PEG and radical length.`,
      },
      {
        id: 'lanc2146-p1-results',
        title: 'Results',
        content: `Figure 1: The effects of four different concentrations of PEG used for seed priming on the radical length of wheat seedlings`,
      },
    ],
    resultsFigure: {
      caption: 'Figure 1: The effects of four different concentrations of PEG used for seed priming on the radical length of wheat seedlings',
      imageUrl: '/lanc2146-seed-priming-results.png',
      graphDescription: 'The graph shows the effects of four different concentrations of PEG (5%, 10%, 15%, 20%) on the radical length of wheat seedlings, compared to a control group.',
    },
  },
];

// LANC2070 practice test interface (article review with main article + source excerpts, A2-B1 level)
export interface Lanc2070PracticeTest {
  id: string;
  title: string;
  description: string;
  writingPrompt: string;
  cefrLevel: string;
  expectedParagraphs: number;
  mainArticle: {
    id: string;
    title: string;
    author: string;
    year: number;
    content: string;
  };
  excerpts: {
    id: string;
    author: string;
    year: number;
    title: string;
    content: string;
  }[];
  targetWordCount: {
    min: number;
    max: number;
    ideal: number;
  };
  practiceType: 'mid-semester' | 'final';
}

export const LANC2070_PRACTICE_TESTS: Lanc2070PracticeTest[] = [
  {
    id: 'lanc2070-p1-final-article-review',
    title: 'Final Exam Writing Practice — Article Review',
    description: 'Write a FOUR paragraph article review (320-350 words) that critically analyses the assigned article. Review any 2 points discussed by the author, use at least 2 excerpts to support your answer, and cite sources in-text using APA format.',
    writingPrompt: 'Write a FOUR paragraph article review (320-350 words) that critically analyses the article "The Impact of Artificial Intelligence in Business" written by Ben Eubanks in 2021.\n\nReview any 2 points discussed by the author.\nYou must use at least 2 excerpts to support your answer. You may use more.\nYou must cite the sources in-text.\nYou MUST paraphrase. Do not copy chunks of 3 words or more.',
    cefrLevel: 'A2-B1',
    expectedParagraphs: 4,
    practiceType: 'final',
    targetWordCount: { min: 320, max: 350, ideal: 335 },
    mainArticle: {
      id: 'lanc2070-p1-main-article',
      title: 'The Impact of Artificial Intelligence in Business',
      author: 'Ben Eubanks',
      year: 2021,
      content: `Artificial intelligence (AI) refers to a range of computer technologies that are designed to learn, reason, and make decisions in ways that resemble human thinking. In the business world, AI is no longer a distant concept; it is already being used across many industries to improve efficiency, reduce costs, and create new opportunities. Examples of these technologies are already familiar to most people, from personalised recommendations on streaming platforms to customer service chatbots. As these tools become more widely available and affordable, their influence on how organisations operate is growing rapidly, making it essential for business leaders to understand both the opportunities and the risks that AI presents.
One of the most significant ways AI is transforming business is by increasing operational efficiency and generating valuable insights. Companies are integrating AI tools into their daily operations to automate repetitive tasks, analyse large volumes of data more quickly than any human team could, and identify patterns that would otherwise go unnoticed. This allows organisations to make faster and more informed decisions, reduce human error, and allocate their human workforce toward more complex and creative responsibilities. In sectors such as finance, healthcare, logistics, and retail, AI-driven systems are already producing measurable improvements in speed, accuracy, and cost-effectiveness. However, these benefits are not equally accessible to all organisations. Smaller businesses with limited budgets and weaker digital infrastructure may struggle to implement AI solutions effectively, meaning that the efficiency gains AI offers risk widening the gap between large and small competitors in many industries.
A second major impact of AI on business concerns the workforce and the future of employment. As AI systems become capable of performing tasks that were previously done by humans, including data analysis, customer interaction, and even elements of decision-making, concerns about job displacement have grown significantly. Some roles will undoubtedly be reduced or eliminated as automation becomes more cost-effective than human labour. However, it is important to recognise that technological change has historically created new types of work alongside the jobs it removes. Search engine optimisation, for example, is a professional discipline that did not exist before the rise of internet search tools, yet it now supports thousands of careers worldwide. Similarly, the growth of AI is already generating demand for new roles in areas such as data science, AI ethics, and technology management. The key challenge for businesses is therefore not simply to adopt AI, but to prepare their workforce for the changes it will bring through targeted training, reskilling, and a clear understanding of which human capabilities machines cannot replicate.
A third area of impact involves the growing importance of uniquely human skills in an increasingly automated workplace. As machines take over more routine and analytical tasks, the abilities that remain distinctly human, such as empathy, creativity, ethical judgement, and the capacity to build genuine relationships, become more valuable rather than less. Businesses that rely heavily on trust, personal interaction, and nuanced communication cannot simply replace their human workforce with algorithms, as these qualities are difficult to automate convincingly. At the same time, organisations must ensure that their employees develop the skills needed to work effectively alongside AI tools, including the ability to evaluate the reliability of AI-generated information, adapt to rapidly changing technological environments, and apply sound judgement in situations where data alone cannot provide a complete answer. Achieving this balance between the efficiency of machines and the irreplaceable qualities of human workers is one of the central leadership challenges that AI presents to businesses today and in the years ahead.
AI is transforming the way businesses operate, and its influence will only grow in the years ahead. Organisations that use AI to improve efficiency, adapt their workforce, and maintain a strong human element are best positioned for long-term success. However, the benefits of AI are not equally accessible to all businesses, and without careful planning, smaller organisations and lower-skilled workers risk being left behind. AI is ultimately a tool, and its value depends entirely on how responsibly and thoughtfully it is applied.`,
    },
    excerpts: [
      {
        id: 'lanc2070-p1-excerpt-eclac',
        author: 'Economic Commission for Latin America and the Caribbean (ECLAC)',
        year: 2021,
        title: 'Digital technologies for a new future',
        content: 'Technological progress has gone along with socially negative outcomes, such as the exclusion of a large proportion of the world\'s people from the benefits of digitalization, essentially because their incomes are too low for them to have good connectivity (i.e., high-quality access), access to devices, fixed home connections, and the ability to use these day to day.',
      },
      {
        id: 'lanc2070-p1-excerpt-ahmed',
        author: 'Ahmed, A.',
        year: 2025,
        title: 'Things humans can still do better than machines',
        content: 'Freeing professionals from the difficult aspect of their work could allow them to dedicate more time and attention to cultivating skills that are peculiarly human, such as empathy and interpersonal relationships, which, for the time being, clearly remain a human element.',
      },
      {
        id: 'lanc2070-p1-excerpt-williams',
        author: 'Williams, M.',
        year: 2021,
        title: 'Career in Search Engine Optimization: The Definitive Guide',
        content: 'SEO or Search Engine Optimization is a growing field that offers many opportunities for creative thinkers and problem solvers. If you enjoy researching and finding the underlying cause of things, you have the potential to earn a great living while helping the world find the information they are looking for.',
      },
      {
        id: 'lanc2070-p1-excerpt-tucci',
        author: 'Tucci, L.',
        year: 2021,
        title: 'A guide to artificial intelligence in the enterprise',
        content: 'The application of artificial intelligence in the enterprise is profoundly changing the way businesses work. Companies are incorporating AI technologies into their business operations with the aim of saving money, boosting efficiency, generating insights and creating new markets.',
      },
      {
        id: 'lanc2070-p1-excerpt-rainie',
        author: 'Rainie, L., and Anderson, J.',
        year: 2018,
        title: 'Artificial Intelligence and the Future of Humans',
        content: 'The experts predicted networked artificial intelligence would amplify human effectiveness but also threaten human autonomy, agency and capabilities. They spoke of the wide-ranging possibilities; that computers might match or even exceed human intelligence and capabilities on tasks such as complex decision-making, reasoning and learning, sophisticated analytics and pattern recognition, visual acuity, speech recognition and language translation.',
      },
      {
        id: 'lanc2070-p1-excerpt-echeverri',
        author: 'Echeverri, M.',
        year: 2020,
        title: 'Three steps to advance AI skills in your organization',
        content: 'The enormous opportunities and benefits artificial intelligence can bring to an organization require skills development programs designed to ensure consistency and intentional outcomes. A prescriptive approach to AI skills development in AI literacy, contextual AI knowledge, and AI solution-building capabilities are critical for success.',
      },
    ],
  },
  {
    id: 'lanc2070-p2-final-colleges-jobs',
    title: 'Final Exam Writing Practice — Colleges and Future Jobs',
    description: 'Write a four-paragraph essay (320-350 words) about 2 ways colleges can follow to prepare students for future jobs, based on the provided source text. You must paraphrase the source material and cite the source in-text using APA format.',
    writingPrompt: 'Write an essay about 2 ways colleges can follow to prepare students for future jobs.\n\nYou must cite the source in-text using APA format.\nYou MUST paraphrase. Do not copy chunks of 3 words or more.',
    cefrLevel: 'A2-B1',
    expectedParagraphs: 4,
    practiceType: 'final',
    targetWordCount: { min: 320, max: 350, ideal: 335 },
    mainArticle: {
      id: 'lanc2070-p2-main-article',
      title: 'How colleges are preparing students for jobs that don\u2019t exist yet',
      author: 'PBS NewsHour',
      year: 2019,
      content: `Eighty-five percent of the jobs that today\u2019s students will do in 2030 don\u2019t exist yet, the Institute for the Future has predicted.
That might seem like a high number to reach in only 12 years. But think about the now-mainstream careers that did not exist just a handful of years ago: drone operator, social media manager, app developer and cloud computing engineer, among others.
Even if that 85 percent is ultimately smaller, the number begs an important question about how the workforce is preparing for the future, starting in the classroom. What role should colleges and universities play in preparing students for a workplace that is constantly changing?
Educational institutions are trying to answer that question, largely by adapting their programs to better suit an ever-shifting work landscape. Here are some of the approaches they\u2019re taking.
Stop thinking about higher education as a four-year, linear journey
Those who study the intersection of education and the future of work say the four-year learning model needs to be rethought in a big way. They say education can no longer be seen as something that stops when a person graduates from college.
Jonathan Blake Huer, an education professional who consults with colleges to address the needs of the changing workforce, said he imagines a world where college is not four consecutive years at all.
\u201cI would prefer if the education system is more fluid so [students] can go in and out of it,\u201d he said.
\u201cIf students could take a year or two of school, get a job, and then return to school a few years later\u201d, Huer said, \u201cthe education system would offer true life-long learning and better adapt to changing technology\u201d.
\u201cWhat we need to start doing is\u2026to create an ecosystem where people are constantly being educated.\u201d In the meantime, online programs are filling in the gaps. Universities are offering more online courses. Private companies like LinkedIn Learning, which absorbed Lynda.com, are also teaching people new skills through online videos via online subscription services.
\u201cWe can\u2019t possibly prepare people for all of the jobs that are ahead,\u201d Brandon Busteed, the president of Kaplan University Partners, which supports U.S. colleges and universities adapt to the changing world. \u201cWhat we need to start doing is creating the scaffolding to create an ecosystem where people are constantly being educated and retooled to stay relevant in their jobs.\u201d
The good news, Busteed said, is that our education systems have been forced to adapt to major disruptions in the past, and it\u2019s likely they will figure out how to do so again. Some universities are already trying to make the shift.
Find ways to fill the skill gap
Internships, which many colleges already offer, appear to be the new kind of training program, though Busteed said universities could do more to integrate them part of a student\u2019s graduation requirements.
At the University of Utah, the new Degree Plus program seeks to fill the job skills gap. It offers eight-week courses intended as an add-on to a student\u2019s main degree. The courses include data analysis, web design and digital marketing, all taught by industry professionals.
The goal \u201cwas to take a foundational degree and recognize that if you pair it with something more concentrated and technical, it can open up more opportunities,\u201d said Andrea Miller, the University of Utah\u2019s director of professional education.
It is additional work, and an additional cost, but Miller said many students find the added value is worth it. Anthropology majors could benefit from understanding data analysis, for example. Students studying political science could see value in understanding content management or marketing, giving them an opportunity when looking for jobs or getting a promotion a few years down the road. The model is similar to \u201cbadge\u201d programs, which aim to give students a certificate showing they know a skill that employers might find useful.
As the job market changes, the University of Utah also plans to eliminate and add courses more frequently. That rapid-response mentality is easier done in a supplemental program like Degree Plus than it is in more established yearslong programs taught by professors, who offer a deep base of knowledge but aren\u2019t necessarily focused on workplace practices.
Making the classroom more like the office
Other institutions are trying to mimic the workplace within the traditional classroom. Several public colleges have partnered with private companies, like the software company Adobe, to integrate their products into the classroom. Professors at schools who partner with the company are encouraged to use the product for atypical assignments, like reinterpreting poems using video. Students at the University of Central Florida have used the software to design 3D-printed limbs.
\u201cThese colleges are teaching digital communication and creative problem solving with assignments that ask students to understand problems, find solutions and then take action,\u201d said Tacy Trowbridge, head of Adobe\u2019s global education programs.
The idea is that students learn how to create a project that can be used in the real world, drawing on the skills a student would need in a business setting rather than those they\u2019d use for taking a test. They also learn the \u201csoft skills\u201d that employers say are increasingly difficult to find in a job candidate.
Students can design their own courses, such as \u201cBlockchain Fundamentals\u201d and \u201cImpact of AI,\u201d a class that explores \u201cvarious economic, social, and ethical challenges facing AI.\u201d \u201cWe\u2019re not just about preparing kids for work,\u201d said Jenn Stringer, the chief academic technology officer at the University of California, Berkeley. \u201cWe hope we are preparing them to have a huge impact on society in some way.\u201d That way, she said, they will not only be prepared for whatever the job market looks like in 10, 20 or 50 years. They will be the ones shaping it.`,
    },
    excerpts: [],
  },
];

export interface AssessmentRecord {
  id: string;
  assessment: Assessment;
  course: Course | null;
  essayText: string;
  createdAt: string;
}

interface AppState {
  // Navigation
  currentStep: AppStep;
  setStep: (step: AppStep) => void;
  
  // Settings
  geminiApiKey: string;
  assessmentApiKey: string;
  theme: 'light' | 'dark' | 'system';
  setGeminiApiKey: (key: string) => void;
  setAssessmentApiKey: (key: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // OCR completion tracking (for cooldown timer)
  ocrCompletedAt: number | null;
  setOcrCompletedAt: (ts: number | null) => void;
  
  // Course selection
  selectedCourse: Course | null;
  courses: Course[];
  setSelectedCourse: (course: Course | null) => void;
  selectedExamType: ExamType;
  setSelectedExamType: (examType: ExamType) => void;
  selectedWritingType: WritingType;
  setSelectedWritingType: (writingType: WritingType) => void;
  selectedPracticeType: PracticeType;
  setSelectedPracticeType: (practiceType: PracticeType) => void;
  selectedSourceTextId: string | null;
  setSelectedSourceTextId: (sourceTextId: string | null) => void;
  
  // Essay management
  currentEssay: Essay | null;
  essays: Essay[];
  setCurrentEssay: (essay: Essay | null) => void;
  addEssay: (essay: Essay) => void;
  updateEssay: (id: string, updates: Partial<Essay>) => void;
  
  // Processing state
  isProcessing: boolean;
  processingMessage: string;
  setProcessing: (isProcessing: boolean, message?: string) => void;
  
  // Writing prompt (optional, for FP0340 Final Exam)
  writingPrompt: string;
  setWritingPrompt: (prompt: string) => void;

  // OCR result (extracted text before assessment)
  extractedText: string;
  setExtractedText: (text: string) => void;
  
  // Assessment result
  currentAssessment: Assessment | null;
  setCurrentAssessment: (assessment: Assessment | null) => void;
  
  // Records
  records: AssessmentRecord[];
  addRecord: (record: AssessmentRecord) => void;
  deleteRecord: (id: string) => void;
  clearAllRecords: () => void;

  // UI state
  showInstallPrompt: boolean;
  setShowInstallPrompt: (show: boolean) => void;
  
  // Reset
  resetAssessment: () => void;
}

// Default courses
const defaultCourses: Course[] = [
  {
    id: 'course-0230',
    code: '0230',
    name: 'English Language Foundation I (FP0230)',
    program: 'foundation',
    description: 'Foundation year English course focusing on basic writing skills.'
  },
  {
    id: 'course-0340',
    code: '0340',
    name: 'English Language Foundation II (FP0340)',
    program: 'foundation',
    description: 'Foundation year English course focusing on basic writing skills.'
  },
  {
    id: 'course-lanc1070',
    code: 'LANC1070',
    name: 'Academic English: Essay Writing (LANC1070)',
    program: 'post-foundation',
    description: 'Post-foundation course focusing on 4-paragraph academic essay writing with integrated skills.'
  },
  {
    id: 'course-lanc2160',
    code: 'LANC2160',
    name: 'Academic English: Summary Writing & Synthesis Essay',
    program: 'post-foundation',
    description: 'Post-foundation course focusing on academic summary writing and 2-point synthesis essay writing.'
  },
  {
    id: 'course-lanc2146',
    code: 'LANC2146',
    name: 'Report Writing (LANC2146)',
    program: 'post-foundation',
    description: 'Post-foundation course focusing on academic report writing, including lab report Discussion and Conclusion sections.'
  },
  {
    id: 'course-lanc2070',
    code: 'LANC2070',
    name: 'Academic English: Article Review (LANC2070)',
    program: 'post-foundation',
    description: 'Post-foundation course focusing on academic article review writing with in-text citation and paraphrasing skills.'
  }
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Navigation
      currentStep: 'welcome',
      setStep: (step) => set({ currentStep: step }),
      
      // Settings
      geminiApiKey: '',
      assessmentApiKey: '',
      theme: 'system',
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      setAssessmentApiKey: (key) => set({ assessmentApiKey: key }),
      setTheme: (theme) => set({ theme }),

      // OCR completion tracking
      ocrCompletedAt: null,
      setOcrCompletedAt: (ts) => set({ ocrCompletedAt: ts }),
      
      // Course selection
      selectedCourse: null,
      courses: defaultCourses,
      setSelectedCourse: (course) => set({ selectedCourse: course, selectedExamType: null, selectedWritingType: null, selectedPracticeType: null, selectedSourceTextId: null, writingPrompt: '' }),
      selectedExamType: null,
      setSelectedExamType: (examType) => set({ selectedExamType: examType, writingPrompt: '' }),
      writingPrompt: '',
      setWritingPrompt: (prompt) => set({ writingPrompt: prompt }),
      selectedWritingType: null,
      setSelectedWritingType: (writingType) => set({ selectedWritingType: writingType }),
      selectedPracticeType: null as PracticeType,
      setSelectedPracticeType: (practiceType) => set({ selectedPracticeType: practiceType, selectedSourceTextId: null }),
      selectedSourceTextId: null as string | null,
      setSelectedSourceTextId: (sourceTextId: string | null) => set({ selectedSourceTextId: sourceTextId }),
      
      // Essay management
      currentEssay: null,
      essays: [],
      setCurrentEssay: (essay) => set({ currentEssay: essay }),
      addEssay: (essay) => set((state) => ({ essays: [essay, ...state.essays] })),
      updateEssay: (id, updates) => set((state) => ({
        essays: state.essays.map((e) => e.id === id ? { ...e, ...updates } : e),
        currentEssay: state.currentEssay?.id === id 
          ? { ...state.currentEssay, ...updates } 
          : state.currentEssay
      })),
      
      // Processing state
      isProcessing: false,
      processingMessage: '',
      setProcessing: (isProcessing, message = '') => set({ 
        isProcessing, 
        processingMessage: message 
      }),
      
      // OCR result
      extractedText: '',
      setExtractedText: (text) => set({ extractedText: text }),
      
      // Assessment result
      currentAssessment: null,
      setCurrentAssessment: (assessment) => set({ currentAssessment: assessment }),
      
      // Records
      records: [],
      addRecord: (record) => set((state) => ({ records: [record, ...state.records] })),
      deleteRecord: (id) => set((state) => ({
        records: state.records.filter((r) => r.id !== id),
      })),
      clearAllRecords: () => set({ records: [] }),

      // UI state
      showInstallPrompt: false,
      setShowInstallPrompt: (show) => set({ showInstallPrompt: show }),
      
      // Reset
      resetAssessment: () => set({
        currentStep: 'welcome',
        currentEssay: null,
        extractedText: '',
        currentAssessment: null,
        isProcessing: false,
        processingMessage: '',
        ocrCompletedAt: null
      })
    }),
    {
      name: 'awe-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        geminiApiKey: state.geminiApiKey,
        assessmentApiKey: state.assessmentApiKey,
        theme: state.theme,
        selectedCourse: state.selectedCourse,
        selectedExamType: state.selectedExamType,
        selectedWritingType: state.selectedWritingType,
        selectedPracticeType: state.selectedPracticeType,
        writingPrompt: state.writingPrompt,
        selectedSourceTextId: state.selectedSourceTextId,
        essays: state.essays.slice(0, 10), // Keep last 10 essays
        records: state.records, // Keep all records
      })
    }
  )
);
