/**
 * Default YML values
 */
export const defaultYMLValues = {
  experimenter_name: [],
  lab: 'Loren Frank Lab',
  institution: 'University of California, San Francisco',
  experiment_description: '',
  session_description: '',
  session_id: '',
  keywords: [],
  subject: {
    description: 'Long-Evans Rat',
    genotype: '',
    sex: 'M',
    species: 'Rattus norvegicus',
    subject_id: '',
    date_of_birth: '',
    weight: 100,
  },
  data_acq_device: [],
  cameras: [],
  tasks: [],
  associated_files: [],
  associated_video_files: [],
  units: {
    analog: '',
    behavioral_events: '',
  },
  times_period_multiplier: 1.0,
  raw_data_to_volts: 1.0,
  default_header_file_path: '',
  behavioral_events: [],
  device: {
    name: ['Trodes'],
  },
  opto_excitation_source: [],
  optical_fiber: [],
  virus_injection: [],
  fs_gui_yamls: [],
  optogenetic_stimulation_software: "",
  electrode_groups: [],
  ntrode_electrode_group_channel_map: [],

};

/**
 * Form data content when empty; used to clear out form
 */
export const emptyFormData = {
  experimenter_name: [],
  lab: '',
  institution: '',
  experiment_description: '',
  session_description: '',
  session_id: '',
  keywords: [],
  subject: {
    description: '',
    genotype: '',
    sex: 'M',
    species: '',
    subject_id: '',
    date_of_birth: '',
    weight: 0,
  },
  data_acq_device: [],
  cameras: [],
  tasks: [],
  associated_files: [],
  associated_video_files: [],
  units: {
    analog: '',
    behavioral_events: '',
  },
  times_period_multiplier: 0.0,
  raw_data_to_volts: 0.0,
  default_header_file_path: '',
  behavioral_events: [],
  device: {
    name: [],
  },
  electrode_groups: [],
  ntrode_electrode_group_channel_map: [],
  opto_excitation_source: [],
  virus_injection: [],
  optical_fiber: [],
  fs_gui_yamls: [],
};

/**
 * List of device-
 *
 * @returns Devices
 */
export const device = () => {
  return [...['Trodes', 'Tetrode', 'Blackrock']];
};

/**
 * List of genders
 *
 * @returns Genders
 */
export const genderAcronym = () => {
  return [...['M', 'F', 'U', 'O']];
};

/**
 * Full meaning of acronym
 *
 * @returns  Provides the full meaning of gender
 */
export const genders = () => {
  return [...['Male', 'Female', 'Unspecified', '0ther']];
};

/**
 * Data Acquisition Device Name
 *
 * @returns New name object
 */
export const dataAcqDeviceName = () => {
  return [
    ...[
      'SpikeGadgets',
      'Plexon',
      'Tucker-Davis Technologies',
      'Ripple Neuro',
      'BlackRock',
    ],
  ];
};

/**
 * Data Acquisition Device System
 *
 * @returns New system object
 */
export const dataAcqDeviceSystem = () => {
  return [
    ...[
      'Main Control Unit',
      'SpikeGadgets',
      'Pegasus',
      'OmniPlex',
      'Synapse',
      'Nano2',
      'Nano2+Stim',
      'Pico2',
      'Pico2+Stim',
    ],
  ];
};

/**
 * Data Acquisition Device Amplifier
 *
 * @returns New amplifier object
 */
export const dataAcqDeviceAmplifier = () => {
  return [...['Sutter Instrument', 'Intan', 'A-M Systems']];
};

/**
 * Data Acquisition Device ADC circuit
 *
 * @returns New ADC Circuit object
 */
export const dataAcqDeviceADCCircuit = () => {
  return [...['Intan', 'A-M Systems']];
};

/**
 * Camera manufacturers
 *
 * @returns list of camera manufacturers
 */
export const cameraManufacturers = () => {
  return [
    ...[
      'Allied Vision',
      'Ximea',
      'Hamamatsu Photonics',
      'JENOPTIK AG',
      'PCO AG',
      'Photometrics',
      'QImaging Corporation',
      'SPOT Imaging Solutions',
      'Thorlabs',
      'Photonic Science',
      'Diffraction Limited',
      'Teledyne Technologies',
    ],
  ];
};

/**
 * List of labs
 *
 * @returns Labs
 */
export const labs = () => {
  return [
    ...[
      'Air Force Institute of Technology Graduate School of Engineering & Management',
      'Albert Einstein College of Medicine',
      'American University',
      'Arizona State University Campus Immersion',
      'Arizona State University Digital Immersion',
      'Arkansas State University',
      'Augusta University',
      'Auburn University',
      'Azusa Pacific University',
      'Ball State University',
      'Baylor College of Medicine',
      'Baylor University',
      'Binghamton University',
      'Boise State University',
      'Boston College',
      'Boston University',
      'Bowling Green State University',
      'Brandeis University',
      'Brigham Young University',
      'Brown University',
      'California Institute of Technology',
      'California State University, East Bay',
      'California State University, Fresno',
      'California State University, Fullerton',
      'California State University, Long Beach',
      'California State University, San Bernardino',
      'Carnegie Mellon University',
      'Case Western Reserve University',
      'Catholic University of America',
      'Central Michigan University',
      'Chapman University',
      'Claremont Graduate University',
      'Clark Atlanta University',
      'Clark University',
      'Clarkson University',
      'Clemson University',
      'Cleveland State University',
      'College of William and Mary',
      'Colorado School of Mines',
      'Colorado State University',
      'Columbia University',
      'Cornell University',
      'Creighton University',
      'CUNY City College',
      'Dartmouth College',
      'DePaul University',
      'Drexel University',
      'Duke University',
      'Duquesne University',
      'East Carolina University',
      'East Tennessee State University',
      'Eastern Michigan University',
      'Eastern Virginia Medical School',
      'Emory University',
      'Florida Agricultural and Mechanical University',
      'Florida Atlantic University',
      'Florida Institute of Technology',
      'Florida International University',
      'Florida State University',
      'Fordham University',
      'George Mason University',
      'George Washington University',
      'Georgetown University',
      'Georgia Institute of Technology',
      'Georgia Southern University',
      'Georgia State University',
      'Graduate Center, CUNY',
      'Harvard University',
      'Howard University',
      'Icahn School of Medicine at Mount Sinai',
      'Idaho State University',
      'Illinois Institute of Technology',
      'Illinois State University',
      'Indiana University – Purdue University Indianapolis',
      'Indiana University Bloomington',
      'Indiana University of Pennsylvania',
      'Iowa State University',
      'Jackson State University',
      'James Madison University',
      'Johns Hopkins University',
      'Kansas State University',
      'Kennesaw State University',
      'Kent State University',
      'Lehigh University',
      'Loma Linda University',
      'Long Island University',
      'Louisiana State University',
      'Louisiana Tech University',
      'Loyola Marymount University',
      'Loyola University Chicago',
      'Marquette University',
      'Marshall University',
      'Massachusetts Institute of Technology',
      'Mayo Clinic College of Medicine and Science',
      'Medical College of Wisconsin',
      'Medical University of South Carolina',
      'Mercer University',
      'Miami University',
      'Michigan State University',
      'Michigan Technological University',
      'Middle Tennessee State University',
      'Mississippi State University',
      'Missouri University of Science and Technology',
      'Montana State University',
      'Montclair State University',
      'Morgan State University',
      'New Jersey Institute of Technology',
      'New Mexico State University',
      'New York University',
      'North Carolina A & T State University',
      'North Carolina State University',
      'North Dakota State University',
      'Northeastern University',
      'Northern Arizona University',
      'Northern Illinois University',
      'Northwestern University',
      'Nova Southeastern University',
      'Oakland University',
      'Ohio State University',
      'Ohio University',
      'Oklahoma State University–Stillwater',
      'Old Dominion University',
      'Oregon Health & Science University',
      'Oregon State University',
      'Pennsylvania State University',
      'Portland State University',
      'Prairie View A&M University',
      'Princeton University',
      'Purdue University',
      'Rensselaer Polytechnic Institute',
      'Rice University',
      'Rochester Institute of Technology',
      'Rockefeller University',
      'Rowan University',
      'Rutgers University–Camden',
      'Rutgers University–New Brunswick',
      'Rutgers University–Newark',
      'Saint Louis University',
      'Sam Houston State University',
      'San Diego State University',
      'San Francisco State University',
      'Seton Hall University',
      'South Dakota State University',
      'Southern Illinois University Carbondale',
      'Southern Methodist University',
      'Southern University',
      'Stanford University',
      'Stevens Institute of Technology',
      'Stony Brook University',
      'SUNY College of Environmental Science and Forestry',
      'Syracuse University',
      'Tarleton State University',
      'Teachers College at Columbia University',
      'Temple University',
      'Tennessee State University',
      'Tennessee Technological University',
      'Texas A&M University',
      'Texas A&M University–Corpus Christi',
      'Texas A&M University–Kingsville',
      'Texas Christian University',
      'Texas Southern University',
      'Texas State University',
      'Texas Tech University',
      'Texas Tech University Health Sciences Center',
      'The New School',
      'Thomas Jefferson University',
      'Tufts University',
      'Tulane University',
      'Uniformed Services University of the Health Sciences',
      'University at Albany, SUNY',
      'University at Buffalo',
      'University of Akron Main Campus',
      'University of Alabama',
      'University of Alabama at Birmingham',
      'University of Alabama in Huntsville',
      'University of Alaska Fairbanks',
      'University of Arizona',
      'University of Arkansas',
      'University of Arkansas at Little Rock',
      'University of Arkansas for Medical Sciences',
      'University of California, Berkeley',
      'University of California, Davis',
      'University of California, Irvine',
      'University of California, Los Angeles',
      'University of California, Merced',
      'University of California, Riverside',
      'University of California, San Diego',
      'University of California, San Francisco',
      'University of California, Santa Barbara',
      'University of California, Santa Cruz',
      'University of Central Florida',
      'University of Chicago',
      'University of Cincinnati',
      'University of Colorado Boulder',
      'University of Colorado Colorado Springs',
      'University of Colorado Denver',
      'University of Connecticut',
      'University of Dayton',
      'University of Delaware',
      'University of Denver',
      'University of Florida',
      'University of Georgia',
      'University of Hawaii at Manoa',
      'University of Houston',
      'University of Idaho',
      'University of Illinois Chicago',
      'University of Illinois Urbana-Champaign',
      'University of Iowa',
      'University of Kansas',
      'University of Kentucky',
      'University of Louisiana at Lafayette',
      'University of Louisville',
      'University of Maine',
      'University of Maryland, Baltimore',
      'University of Maryland, Baltimore County',
      'University of Maryland, College Park',
      'University of Maryland, Eastern Shore',
      'University of Massachusetts Amherst',
      'University of Massachusetts Boston',
      'University of Massachusetts Chan Medical School',
      'University of Massachusetts Dartmouth',
      'University of Massachusetts Lowell',
      'University of Memphis',
      'University of Miami',
      'University of Michigan',
      'University of Minnesota',
      'University of Mississippi',
      'University of Missouri',
      'University of Missouri–Kansas City',
      'University of Missouri–St. Louis',
      'University of Montana',
      'University of Nebraska at Omaha',
      'University of Nebraska Medical Center',
      'University of Nebraska–Lincoln',
      'University of Nevada, Las Vegas',
      'University of Nevada, Reno',
      'University of New England',
      'University of New Hampshire',
      'University of New Mexico',
      'University of New Orleans',
      'University of North Carolina at Chapel Hill',
      'University of North Carolina at Charlotte',
      'University of North Carolina at Greensboro',
      'University of North Carolina Wilmington',
      'University of North Dakota',
      'University of North Florida',
      'University of North Texas',
      'University of Notre Dame',
      'University of Oklahoma',
      'University of Oklahoma Health Sciences Center',
      'University of Oregon',
      'University of Pennsylvania',
      'University of Pittsburgh',
      'University of Puerto Rico at Río Piedras',
      'University of Rhode Island',
      'University of Rochester',
      'University of San Diego',
      'University of South Alabama',
      'University of South Carolina',
      'University of South Dakota',
      'University of South Florida',
      'University of Southern California',
      'University of Southern Mississippi',
      'University of Tennessee',
      'University of Tennessee Health Science Center',
      'University of Texas at Arlington',
      'University of Texas at Austin',
      'University of Texas at Dallas',
      'University of Texas at El Paso',
      'University of Texas at San Antonio',
      'University of Texas Health Science Center at Houston',
      'University of Texas Health Science Center at San Antonio',
      'University of Texas Medical Branch',
      'University of Texas Southwestern Medical Center',
      'University of Toledo',
      'University of Tulsa',
      'University of Utah',
      'University of Vermont',
      'University of Virginia',
      'University of Washington',
      'University of Wisconsin–Madison',
      'University of Wisconsin–Milwaukee',
      'University of Wyoming',
      'Utah State University',
      'Vanderbilt University',
      'Villanova University',
      'Virginia Commonwealth University',
      'Virginia Tech',
      'Wake Forest University',
      'Washington State University',
      'Washington University in St. Louis',
      'Wayne State University',
      'Weill Cornell Medicine',
      'West Chester University of Pennsylvania',
      'West Virginia University',
      'Western Michigan University',
      'Wichita State University',
      'Worcester Polytechnic Institute',
      'Wright State University',
      'Yale University',
    ],
  ];
};

/**
 *  List of body parts/region common across species
 *
 * @returns Body parts/regions of a species
 */
export const locations = () => {
  return [
    ...[
      'Brain (Brain)',
      'White matter (wmt)',
      'Olfactory white matter (olf)',
      'lateral olfactory tract (lot)',
      'corpus callosum and associated subcortical white matter (cc-ec-cing-dwm)',
      'Anterior commissure (ac)',
      'anterior commissure, anterior limb (aca)',
      'anterior commissure, posterior limb (acp)',
      'anterior commissure, intrabulbar part (aci)',
      'Hippocampal white matter (hiw)',
      'alveus of the hippocampus (alv)',
      'ventral hippocampal commissure (vhc)',
      'fornix (f)',
      'fimbria of the hippocampus (fi)',
      'Corticofugal pathways (cfp)',
      'corticofugal tract and corona radiata (ic-cp-lfp-py)',
      'pyramidal decussation (pyx)',
      'Medial lemniscus (ml)',
      'medial lemniscus, unspecified (ml-u)',
      'medial lemniscus decussation (mlx)',
      'Thalamic tracts (tht)',
      'External medullary lamina (eml)',
      'external medullary lamina, unspecified (eml-u)',
      'external medullary lamina, auditory radiation (eml-ar)',
      'internal medullary lamina (iml)',
      'intramedullary thalamic area (ima)',
      'superior cerebellar peduncle and prerubral field (scp-pr)',
      'pretectothalamic lamina (ptl)',
      'mammillotegmental tract (mtg)',
      'commissural stria terminalis (cst)',
      'fasciculus retroflexus (fr)',
      'stria medullaris thalami (sm)',
      'stria terminalis (st)',
      'habenular commissure (hbc)',
      'posterior commissure (pc)',
      'Facial nerve (7n)',
      'facial nerve, unspecified (7n-u)',
      'ascending fibers of the facial nerve (asc7)',
      'genu of the facial nerve (g7)',
      'Optic fiber system and supraoptic decussation (ofs)',
      'optic nerve (2n)',
      'optic tract and optic chiasm (opt-och)',
      'supraoptic decussation (sox)',
      'White matter of the tectum (tew)',
      'commissure of the superior colliculus (csc)',
      'brachium of the superior colliculus (bsc)',
      'inferior colliculus, commissure (cic)',
      'inferior colliculus, brachium (bic)',
      'Cerebellar and precerebellar white matter (cbt)',
      'inferior cerebellar peduncle (icp)',
      'middle cerebellar peduncle (mcp)',
      'transverse fibers of the pons (tfp)',
      'White matter of the brainstem (bsw)',
      'Lateral lemniscus (ll)',
      'lateral lemniscus, commissure (ll-c)',
      'lateral lemniscus, unspecified (ll-u)',
      'acoustic striae (as)',
      'trapezoid body (tz)',
      'spinal trigeminal tract (sp5t)',
      'Gray matter (GM)',
      'Telencephalon (Tel)',
      'Laminated pallium (LamP)',
      'Olfactory bulb (OB)',
      'Glomerular layer of the accessory olfactory bulb (GlA)',
      'Glomerular layer of the olfactory bulb (Gl)',
      'Olfactory bulb, unspecified (OB-u)',
      'Nucleus of the lateral olfactory tract (NLOT)',
      'Cerebral cortex (Cx)',
      'Hippocampal region (HR)',
      'Hippocampal formation (HF)',
      'Fasciola cinereum (FC)',
      'Subiculum (SUB)',
      'Cornu Ammonis (CA)',
      'Cornu ammonis 1 (CA1)',
      'Cornu ammonis 2 (CA2)',
      'Cornu ammonis 3 (CA3)',
      'Dentate gyrus (DG)',
      'Parahippocampal region (PHR)',
      'Postrhinal cortex (POR)',
      'Presubiculum (PrS)',
      'Parasubiculum (PaS)',
      'Perirhinal cortex (PER)',
      'Perirhinal area 35 (PER35)',
      'Perirhinal area 36 (PER36)',
      'Entorhinal cortex (EC)',
      'Medial entorhinal cortex (MEC)',
      'Lateral entorhinal cortex (LEC)',
      'Piriform cortex (PIR)',
      'Piriform cortex, layer 1 (PIR1)',
      'Piriform cortex, layer 2 (PIR2)',
      'Piriform cortex, layer 3 (PIR3)',
      'Cingulate region (CgR)',
      'Cingulate cortex (Cg)',
      'Cingulate area 1 (Cg1)',
      'Cingulate area 2 (Cg2)',
      'Retrosplenial cortex (RS)',
      'Retrosplenial dysgranular area (RSD)',
      'Retrosplenial granular area (RSG)',
      'Insular region (INS)',
      'Agranular insular cortex (AI)',
      'Agranular insular cortex, ventral area (AI-v)',
      'Agranular insular cortex dorsal area  (AI-d)',
      'Agranular insular cortex, posterior area  (AI-p)',
      'Dysgranular insular cortex (DI)',
      'Granular insular cortex (GI)',
      'Frontal region (Front)',
      'Frontal association cortex (FrA)',
      'Orbitofrontal cortex (Orb)',
      'Medial orbital area (MO)',
      'Ventral orbital area (VO)',
      'Ventrolateral orbital area (VLO)',
      'Lateral orbital area (LO)',
      'Dorsolateral orbital area (DLO)',
      'Mediofrontal cortex (MFC)',
      'Prelimbic area (PrL)',
      'Infralimbic area (IL)',
      'Motor cortex (M)',
      'Primary motor area (M1)',
      'Secondary motor area (M2)',
      'Frontal association area 3 (Fr3)',
      'Parietal region (Par)',
      'Somatosensory cortex (SS)',
      'Primary somatosensory area (S1)',
      'Primary somatosensory area, face representation (S1-f)',
      'Primary somatosensory area, barrel field (S1-bf)',
      'Primary somatosensory area, dysgranular zone (S1-dz)',
      'Primary somatosensory area, forelimb representation (S1-fl)',
      'Primary somatosensory area, hindlimb representation (S1-hl)',
      'Primary somatosensory area, trunk representation (S1-tr)',
      'Secondary somatosensory area (S2)',
      'Posterior parietal cortex (PPC)',
      'Parietal association cortex, medial area (mPPC)',
      'Parietal association cortex, lateral area (lPPC)',
      'Parietal association cortex, posterior area  (PtP)',
      'Occipital region (Oc)',
      'Visual cortex (Vis)',
      'Primary visual area (V1)',
      'Secondary visual area (V2)',
      'Secondary visual area, medial part (V2M)',
      'Secondary visual area, lateral part (V2L)',
      'Temporal region (Te)',
      'Temporal association cortex (TeA)',
      'Auditory cortex (Au)',
      'Primary auditory area (Au1)',
      'Secondary auditory area (Au2)',
      'Secondary auditory area, dorsal part (Au2-d)',
      'Secondary auditory area, ventral part (Au2-v)',
      'Non-laminated pallium (N-LamP)',
      'Claustrum (CLA)',
      'Endopiriform nucleus (Endo)',
      'Amygdaloid area, unspecified (Am-u)',
      ' Subpallium (SubPAL)',
      'Striatum (Str)',
      'Caudate putamen (CPu)',
      'Nucleus accumbens (NAc)',
      'Nucleus accumbens, core (NAc-c)',
      'Nucleus accumbens, shell (NAc-sh)',
      'Ventral striatal region, unspecified (VSR-u)',
      'Pallidum (PAL)',
      'Globus pallidus external (GPe)',
      'Globus pallidus external, medial part (GPe-m)',
      'Globus pallidus external, lateral part (GPe-l)',
      'Entopeduncular nucleus (EP)',
      'Ventral pallidum (VP)',
      'Basal forebrain region  (BRF)',
      'Basal forebrain region, unspecified (BFR-u)',
      'Bed nucleus of the stria terminalis (BNST)',
      'Septal region (Sep)',
      'Subthalamic nucleus (STh)',
      'Diencephalon (Dien)',
      'Prethalamus (Thal-Pre)',
      'Reticular (pre)thalamic nucleus (RT)',
      'Reticular (pre)thalamic nucleus, unspecified (RT-u)',
      'Reticular (pre)thalamic nucleus, auditory segment (RT-a)',
      'Zona incerta (ZI)',
      'Zona incerta, dorsal part (ZI-d)',
      'Zona incerta, ventral part (ZI-v)',
      'Zona incerta, rostral part (ZI-r)',
      'Zona incerta, caudal part (ZI-c)',
      'Zona incerta, A13 dopamine cells (ZI-A13)',
      'Zona incerta, A11 dopamine cells (ZI-A11)',
      'Fields of Forel (FoF)',
      'Pregeniculate nucleus (PrG)',
      'Subgeniculate nucleus (SubG)',
      'Intergeniculate leaflet (IGL)',
      'Epithalamus (Thal-EPI)',
      'Lateral habenular nucleus (LHb)',
      'Medial habenular nucleus (MHb)',
      'Nucleus of the stria medullaris (SMn)',
      'Pineal gland (PG)',
      'Dorsal thalamus (Thal-D)',
      'Anterior nuclei of the dorsal thalamus (ANT)',
      'Anterodorsal thalamic nucleus (AD)',
      'Anteroventral thalamic nucleus (AV)',
      'Anteroventral thalamic nucleus, dorsomedial part (AV-dm)',
      'Anteroventral thalamic nucleus, ventrolateral part (AV-vl)',
      'Anteromedial thalamic nucleus (AM)',
      'Interanteromedial thalamic nucleus (IAM)',
      'Paraventricular thalamic nuclei (anterior and posterior) (PV)',
      'Intermediodorsal thalamic nucleus (IMD)',
      'Parataenial thalamic nucleus (PT)',
      'Subparafascicular nucleus (SPF)',
      'Posterior intralaminar nucleus (PIL)',
      'Ventral midline group of the dorsal thalamus (V-MID)',
      'Rhomboid thalamic nucleus (Rh)',
      'Reuniens thalamic nucleus (Re)',
      'Retroreuniens thalamic nucleus (RRe)',
      'Xiphoid thalamic nucleus (Xi)',
      'Mediodorsal nucleus of the dorsal thalamus (MD)',
      'Mediodorsal thalamic nucleus, lateral part (MD-l)',
      'Mediodorsal thalamic nucleus, central part (MD-c)',
      'Mediodorsal thalamic nucleus, medial part (MD-m)',
      'Ventral nuclei of the dorsal thalamus (VENT)',
      'Ventral anterior thalamic nucleus (VA)',
      'Ventromedial thalamic nucleus (VM)',
      'Ventrolateral thalamic nucleus (VL)',
      'Angular thalamic nucleus (Ang)',
      'Ventral posterior thalamic nucleus (VPN)',
      'Ventral posteromedial thalamic nucleus (VPM)',
      'Ventral posterolateral thalamic nucleus (VPL)',
      'Ventral posterior nucleus of the thalamus, parvicellular part (VP-pc)',
      'Submedius thalamic nucleus (SMT)',
      'Intralaminar nuclei of the dorsal thalamus (ILM)',
      'Paracentral thalamic nucleus (PCN)',
      'Central medial thalamic nucleus (CM)',
      'Central lateral thalamic nucleus (CL)',
      'Parafascicular thalamic nucleus (PF)',
      'Ethmoid-Limitans nucleus (Eth)',
      'Posterior complex of the dorsal thalamus (PoC)',
      'Posterior thalamic nucleus (Po)',
      'Posterior thalamic nuclear group, triangular part (Po-t)',
      'Lateral posterior (pulvinar) complex of the dorsal thalamus (LP)',
      'Lateral posterior thalamic nucleus, mediorostral part (LP-mr)',
      'Lateral posterior thalamic nucleus, mediocaudal part (LP-mc)',
      'Lateral posterior thalamic nucleus, lateral part (LP-l)',
      'Laterodorsal thalamic nuclei of the dorsal thalamus (LD)',
      'Laterodorsal thalamic nucleus, dorsomedial part (LD-dm)',
      'Laterodorsal thalamic nucleus, ventrolateral part (LD-vl)',
      'Dorsal lateral geniculate nucleus (DLG)',
      'Medial geniculate complex of the dorsal thalamus (MG)',
      'Medial geniculate body, ventral division (MG-v)',
      'Medial geniculate body, dorsal division (MG-d)',
      'Medial geniculate body, marginal zone (MG-mz)',
      'Medial geniculate body, medial division (MG-m)',
      'Medial geniculate body, suprageniculate nucleus (MG-sg)',
      'Hypothalamus (HY)',
      'Hypothalamic region, unspecified (HTh-u)',
      'Pretectum (PreT)',
      'Pretectal region (PRT)',
      'Nucleus sagulum (Sag)',
      'Mesencephalon (Mes)',
      'Midbrain (MB)',
      'Tectum (Tc)',
      'Inferior colliculus (IC)',
      'Inferior colliculus, dorsal cortex (DCIC)',
      'Inferior colliculus, central nucleus (CNIC)',
      'Inferior colliculus, external cortex (ECIC)',
      'Superior colliculus (Su)',
      'Superficial gray layer of the superior colliculus (SuG)',
      'Deeper layers of the superior colliculus (SuD)',
      'Tegmentum (Tg)',
      'Substantia nigra (SN)',
      'Substantia nigra, reticular part (SN-r)',
      'Substantia nigra, compact part (SN-c)',
      'Substantia nigra, lateral part (SN-l)',
      'Ventral tegmental area (VTA)',
      'Peripeduncular nucleus (PP)',
      'Interpeduncular nucleus (IP)',
      'Periaqueductal gray (PAG)',
      'Brainstem, unspecified (BS-u)',
      'Rhombencephalon (Rho)',
      'Metencephalon (Met)',
      'Pontine nuclei (Pn)',
      'Cerebellum (Cb)',
      'Molecular cell layer of the cerebellum (Cb-m)',
      'Cerebellum, unspecified (Cb-u)',
      'Myelencephalon (Myel)',
      'Cochlear nucleus, ventral part (VCN)',
      'Ventral cochlear nucleus, anterior part (AVCN)',
      'Ventral cochlear nucleus, posterior part (PVCN)',
      'Ventral cochlear nucleus, cap area (Cap)',
      'Ventral cochlear nucleus, granule cell layer (GCL)',
      'Cochlear nucleus, dorsal part (DCN)',
      'Dorsal cochlear nucleus, molecular layer (DCNM)',
      'Dorsal cochlear nucleus, fusiform and granule layer (DCNFG)',
      'Dorsal cochlear nucleus, deep core (DCND)',
      'Spinal trigeminal nucleus (Sp5n)',
      'Periventricular gray (PVG)',
      'Superior olivary complex (SO)',
      'Nucleus of the trapezoid body (NTB)',
      'Superior paraolivary nucleus (SPN)',
      'Medial superior olive (MSO)',
      'Lateral superior olive (LSO)',
      'Superior periolivary region (SPR)',
      'Ventral periolivary nuclei (VPO)',
      'Nuclei of the lateral lemniscus (NLL)',
      'Lateral lemniscus, ventral nucleus (VLL)',
      'Lateral lemniscus, intermediate nucleus (ILL)',
      'Lateral lemniscus, dorsal nucleus (DLL)',
      'Inferior olive (IO)',
      'Ventricular system (V)',
      'ventricular system, unspecified (V-u)',
      '4th ventricle (4V)',
      'central canal (CC)',
      'spinal cord (SpC)',
      'Inner ear (IE)',
      'vestibular apparatus (VeA)',
      'cochlea (Co)',
      'cochlear nerve (8cn)',
      'vestibular nerve (8vn)',
      'spiral ganglion (SpG)',
    ],
  ];
};

/**
 * List of device-types
 *
 * @returns Device types
 */
export const deviceTypes = () => {
  return [
    ...[
      'tetrode_12.5',
      'A1x32-6mm-50-177-H32_21mm',
      '128c-4s8mm6cm-20um-40um-sl',
      '128c-4s6mm6cm-15um-26um-sl',
      '32c-2s8mm6cm-20um-40um-dl',
      '64c-4s6mm6cm-20um-40um-dl',
      '64c-3s6mm6cm-20um-40um-sl',
      'NET-EBL-128ch-single-shank',
    ],
  ];
};

/**
 * List of units
 *
 * @returns Units
 */
export const units = () => {
  return [...['pm', 'nm', 'μm', 'mm', 'cm', 'in', 'yd', 'ft']];
};

export const genotypes = () => {
  return [
    ...[
      'ApoE',
      'SCN2A',
      'Wild Type',
    ],
  ];
};

/**
 * List of species
 *
 * @returns Species
 */
export const species = () => {
  // from Charles River
  return [
    ...[
        'Callithrix jacchus',
        'Danio rerio',
        'Drosophila melanogaster',
        'Fringilla coelebs',
        'Macaca mulatta',
        'Mesocricetus auratus',
        'Mus musculus',
        'Oryctolagus cuniculus',
        'Rattus norvegicus',
        'sus scrofa',
    ],
  ];
};

/**
 * List of Behavioral events names
 *
 * @returns Behavioral events names
 */
export const behavioralEventsNames = () => {
  return [
    ...[
      'Home box camera',
      'Poke',
      'Light',
      'Pump',
      'Run Camera Ticks',
      'Sleep',
    ],
  ];
};

/**
 * List of Behavioral events descriptions
 *
 * @returns Behavioral events descriptions
 */
export const behavioralEventsDescription = () => {
  return [...['Din', 'Dout', 'Accel', 'Gyro', 'Mag']];
};

/**
 * List of Optogenetic Excitation Source model name
 *
 * @returns Hardware
 */
export const optoExcitationModelNames = () => {
  return [
    ...[
      'Lux+ 638-200',
    ],
  ];
};

export const opticalFiberModelNames = () => {
  return [
    ...[
      'optogenix_lambda_fiber',
    ],
  ];
}

export const virusNames = () => {
  return [
    ... [
      "AAV-1-EF1a-DIO-ChRmine-mScarlet-WPRE",
      "AAV-8-EF1a-DIO-ChRmine-mScarlet-WPRE",
    ],
  ];
};

/**
 * Default values for arrays entries
 */
export const arrayDefaultValues = {
  data_acq_device: {
    name: 'SpikeGadgets',
    system: 'SpikeGadgets',
    amplifier: 'Intan',
    adc_circuit: 'Intan',
  },
  associated_files: {
    name: '',
    description: '',
    path: '',
    task_epochs: '',
  },
  cameras: {
    id: 0,
    meters_per_pixel: 0,
    manufacturer: '',
    model: '',
    lens: '',
    camera_name: '',
  },
  tasks: {
    task_name: '',
    task_description: '',
    task_environment: '',
    camera_id: [],
    task_epochs: [],
  },
  associated_video_files: {
    name: '',
    camera_id: '',
    task_epochs: '',
  },
  behavioral_events: {
    description: 'Din1',
    name: '', // 'Home box camera',
  },
  electrode_groups: {
    id: 0,
    location: '', // 'Cornu ammonis 1 (CA1)',
    device_type: '',
    description: '',
    targeted_location: '', // 'Cornu ammonis 1 (CA1)',
    targeted_x: '',
    targeted_y: '',
    targeted_z: '',
    units: 'μm',
  },
  ntrode_electrode_group_channel_map: {
    ntrode_id: 1,
    electrode_group_id: '',
    bad_channels: [],
    map: {},
  },

  opto_excitation_source: {
    name: 'Omicron LuxX+ Blue',
    model_name: 'Omicron LuxX+ 488-100',
    description: 'Laser for optogenetic stimulation',
    wavelength_in_nm: 488.0,
    power_in_W: 0.077,
    intensity_in_W_per_m2: 1e10,
  },

  optical_fiber: {
    name: 'Optical fiber 1',
    hardware_name : '',
    implanted_fiber_description: '',
    location : '',
    hemisphere : '',
    ap_in_mm : 0.0,
    ml_in_mm : 0.0,
    dv_in_mm : 0.0,
    roll_in_deg :0.0,
    pitch_in_deg : 0.0,
    yaw_in_deg : 0.0,
    reference : 'Bregma at the cortical surface',
    excitation_source   : '',
  },

  virus_injection: {
    name: 'Injection 1',
    description : 'Viral injection for optogenetic stimulation',
    hemisphere : '',
    location : '',
    ap_in_mm : 0.0,
    ml_in_mm : 0.0,
    dv_in_mm : 0.0,
    roll_in_deg : 0.0,
    pitch_in_deg : 0.0,
    yaw_in_deg : 0.0,
    reference : 'Bregma at the cortical surface',
    virus_name: '',
    titer_in_vg_per_ml : 1e12,
    volume_in_uL : 0.45,
  },

  fs_gui_yamls: {
    name: '/path/to/fs_gui.yaml',
    epochs: [],
    power_in_mW: 0.0,
    dio_output_name: "",
    state_script_parameters: false,
    pulseLength: 0,
  },

  optogenetic_stimulation_software: "fsgui",
};
