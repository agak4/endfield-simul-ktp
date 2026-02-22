/**
 * [기어 및 세트 기본 구조]
 * 1. DATA_GEAR: [
 *   {
 *     id: string,       // 고유 ID
 *     name: string,     // 기어 이름
 *     part: string,     // 부위 (kit: 가젯, gloves: 장갑, armor: 방어구)
 *     set: string,      // 소속 세트 ID (예: 'set_shikyang')
 *     stat1: string,    // 주능력치 키 (str, agi, int, wil)
 *     val1: number,     // 영웅급(4성) 주능력치 수치
 *     val1_f: number,   // 전설급(5성) 주능력치 수치
 *     stat2: string,    // 부능력치 키
 *     val2: number,     // 영웅급 부능력치 수치
 *     val2_f: number,   // 전설급 부능력치 수치
 *     trait: [          // 기어 고유 특성
 *       { type: string[], val, val_f, stat? }, ...
 *     ]
 *   }, ...
 * ]
 * 
 * 2. DATA_SETS: [
 *   {
 *     id: string,       // 세트 고유 ID
 *     name: string,     // 세트 이름
 *     effects: [        // 세트 효과 (2세트, 4세트 효과 등)
 *       { type: string[], val, target?, triggers? }, ...
 *     ]
 *   }, ...
 * ]
 */
const DATA_GEAR = [
  { id: 'gear_0', name: '식양의 숨결 보조 견갑', part: 'kit', set: 'set_shikyang', stat1: 'wil', val1: 32, val1_f: 41, stat2: 'int', val2: 21, val2_f: 27, trait: [{ type: ['궁극기 충전 효율'], val: '24.6%', val_f: '32%' }] },
  { id: 'gear_1', name: '식양의 숨결 충전 코어 · I', part: 'kit', set: 'set_shikyang', stat1: 'int', val1: 32, val1_f: 41, stat2: 'wil', val2: 21, val2_f: 27, trait: [{ type: ['치유 효율'], val: '20.7%', val_f: '26.9%' }] },
  { id: 'gear_2', name: '식양의 숨결 충전 코어', part: 'kit', set: 'set_shikyang', stat1: 'int', val1: 32, val1_f: 41, stat2: 'str', val2: 21, val2_f: 27, trait: [{ type: ['궁극기 충전 효율'], val: '24.6%', val_f: '32%' }] },
  { id: 'gear_3', name: '식양의 숨결 글러브 · I', part: 'gloves', set: 'set_shikyang', stat1: 'int', val1: 65, val1_f: 84, stat2: 'wil', val2: 43, val2_f: 55, trait: [{ type: ['궁극기 충전 효율'], val: '20.5%', val_f: '26.7%' }] },
  { id: 'gear_4', name: '식양의 숨결 글러브', part: 'gloves', set: 'set_shikyang', stat1: 'int', val1: 65, val1_f: 84, stat2: 'str', val2: 43, val2_f: 55, trait: [{ type: ['궁극기 충전 효율'], val: '20.5%', val_f: '26.7%' }] },
  { id: 'gear_5', name: '식양의 숨결 장갑', part: 'armor', set: 'set_shikyang', stat1: 'wil', val1: 87, val1_f: 113, stat2: 'int', val2: 58, val2_f: 75, trait: [{ type: ['오리지늄 아츠 강도'], val: 20, val_f: 27 }] },
  { id: 'gear_6', name: '탁류 화염 절단기', part: 'kit', set: 'set_joryu', stat1: 'int', val1: 32, val1_f: 41, stat2: 'str', val2: 21, val2_f: 27, trait: [{ type: ['일반 공격 피해'], val: '27.6%', val_f: '35.9%' }] },
  { id: 'gear_7', name: '현하 산소 공급 장치', part: 'kit', set: 'set_joryu', stat1: 'str', val1: 32, val1_f: 41, stat2: 'wil', val2: 21, val2_f: 27, trait: [{ type: ['냉기 피해'], val: '23%', val_f: '29.9%' }, { type: ['전기 피해'], val: '23%', val_f: '29.9%' }] },
  { id: 'gear_8', name: '조류의 물결 건틀릿', part: 'gloves', set: 'set_joryu', stat1: 'str', val1: 65, val1_f: 84, stat2: 'wil', val2: 43, val2_f: 55, trait: [{ type: ['냉기 피해'], val: '19.2%', val_f: '24.9%' }, { type: ['전기 피해'], val: '19.2%', val_f: '24.9%' }] },
  { id: 'gear_9', name: '낙조 경갑', part: 'armor', set: 'set_joryu', stat1: 'int', val1: 87, val1_f: 113, stat2: 'str', val2: 58, val2_f: 75, trait: [{ type: ['궁극기 충전 효율'], val: '12.3%', val_f: '16%' }] },
  { id: 'gear_10', name: '응룡 50식 탐지기', part: 'kit', set: 'set_eungryong', stat1: 'str', val1: 32, val1_f: 41, stat2: 'wil', val2: 21, val2_f: 27, trait: [{ type: ['물리 피해'], val: '23%', val_f: '29.9%' }] },
  { id: 'gear_11', name: '응룡 50식 단검 · I', part: 'kit', set: 'set_eungryong', stat1: 'int', val1: 32, val1_f: 41, stat2: 'str', val2: 21, val2_f: 27, trait: [{ type: ['모든 스킬 피해'], val: '27.6%', val_f: '35.9%' }] },
  { id: 'gear_12', name: '응룡 50식 단검', part: 'kit', set: 'set_eungryong', stat1: 'wil', val1: 32, val1_f: 41, stat2: 'agi', val2: 21, val2_f: 27, trait: [{ type: ['연계 스킬 피해'], val: '41.4%', val_f: '53.8%' }] },
  { id: 'gear_13', name: '응룡 50식 글러브 · I', part: 'gloves', set: 'set_eungryong', stat1: 'wil', val1: 65, val1_f: 84, stat2: 'agi', val2: 43, val2_f: 55, trait: [{ type: ['연계 스킬 피해'], val: '34.5%', val_f: '44.9%' }] },
  { id: 'gear_14', name: '응룡 50식 글러브', part: 'gloves', set: 'set_eungryong', stat1: 'agi', val1: 65, val1_f: 84, stat2: 'int', val2: 43, val2_f: 55, trait: [{ type: ['연계 스킬 피해'], val: '34.5%', val_f: '44.9%' }] },
  { id: 'gear_15', name: '응룡 50식 경갑', part: 'armor', set: 'set_eungryong', stat1: 'wil', val1: 87, val1_f: 113, stat2: 'str', val2: 58, val2_f: 75, trait: [{ type: ['모든 스킬 피해'], val: '13.8%', val_f: '17.9%' }] },
  { id: 'gear_16', name: '응룡 50식 중갑', part: 'armor', set: 'set_eungryong', stat1: 'str', val1: 87, val1_f: 113, stat2: 'wil', val2: 58, val2_f: 75, trait: [{ type: ['물리 피해'], val: '11.5%', val_f: '14.9%' }] },
  { id: 'gear_17', name: 'M. I. 경찰용 단검 · I', part: 'kit', set: 'set_mi_police', stat1: 'wil', val1: 32, val1_f: 41, stat2: 'agi', val2: 21, val2_f: 27, trait: [{ type: ['배틀 스킬 피해'], val: '41.4%', val_f: '53.8%' }] },
  { id: 'gear_18', name: 'M. I. 경찰용 단검', part: 'kit', set: 'set_mi_police', stat1: 'wil', val1: 32, val1_f: 41, stat2: 'int', val2: 21, val2_f: 27, trait: [{ type: ['열기 피해'], val: '23%', val_f: '29.9%' }, { type: ['자연 피해'], val: '23%', val_f: '29.9%' }] },
  { id: 'gear_19', name: 'M. I. 경찰용 도구 세트', part: 'kit', set: 'set_mi_police', stat1: 'int', val1: 32, val1_f: 41, stat2: 'agi', val2: 21, val2_f: 27, trait: [{ type: ['치명타 확률'], val: '10.4%', val_f: '13.5%' }] },
  { id: 'gear_20', name: 'M. I. 경찰용 조준기', part: 'kit', set: 'set_mi_police', stat1: 'agi', val1: 32, val1_f: 41, stat2: 'str', val2: 21, val2_f: 27, trait: [{ type: ['배틀 스킬 피해'], val: '41.4%', val_f: '53.8%' }] },
  { id: 'gear_21', name: 'M. I. 경찰용 수갑', part: 'kit', set: 'set_mi_police', stat1: 'str', val1: 32, val1_f: 41, stat2: 'wil', val2: 21, val2_f: 27, trait: [{ type: ['냉기 피해'], val: '41.4%', val_f: '53.8%' }, { type: ['전기 피해'], val: '41.4%', val_f: '53.8%' }] },
  { id: 'gear_22', name: 'M. I. 경찰용 팔찌 · I', part: 'gloves', set: 'set_mi_police', stat1: 'int', val1: 65, val1_f: 84, stat2: 'wil', val2: 43, val2_f: 55, trait: [{ type: ['치명타 확률'], val: '8.6%', val_f: '11.2%' }] },
  { id: 'gear_23', name: 'M. I. 경찰용 팔찌', part: 'gloves', set: 'set_mi_police', stat1: 'int', val1: 65, val1_f: 84, stat2: 'agi', val2: 43, val2_f: 55, trait: [{ type: ['일반 공격 피해'], val: '23%', val_f: '29.9%' }] },
  { id: 'gear_24', name: 'M. I. 경찰용 장갑', part: 'gloves', set: 'set_mi_police', stat1: 'agi', val1: 65, val1_f: 84, stat2: 'str', val2: 43, val2_f: 55, trait: [{ type: ['배틀 스킬 피해'], val: '34.5%', val_f: '44.9%' }] },
  { id: 'gear_25', name: 'M. I. 경찰용 망토 · II', part: 'armor', set: 'set_mi_police', stat1: 'wil', val1: 87, val1_f: 113, stat2: 'agi', val2: 58, val2_f: 75, trait: [{ type: ['배틀 스킬 피해'], val: '20.7%', val_f: '26.9%' }] },
  { id: 'gear_26', name: 'M. I. 경찰용 망토 · I', part: 'armor', set: 'set_mi_police', stat1: 'int', val1: 87, val1_f: 113, stat2: 'wil', val2: 58, val2_f: 75, trait: [{ type: ['치명타 확률'], val: '5.2%', val_f: '6.7%' }] },
  { id: 'gear_27', name: 'M. I. 경찰용 망토', part: 'armor', set: 'set_mi_police', stat1: 'int', val1: 87, val1_f: 113, stat2: 'agi', val2: 58, val2_f: 75, trait: [{ type: ['일반 공격 피해'], val: '13.8%', val_f: '17.9%' }] },
  { id: 'gear_28', name: 'M. I. 경찰용 방어구', part: 'armor', set: 'set_mi_police', stat1: 'agi', val1: 87, val1_f: 113, stat2: 'str', val2: 58, val2_f: 75, trait: [{ type: ['오리지늄 아츠 강도'], val: 20, val_f: 27 }] },
  { id: 'gear_29', name: '열 작업용 전력 상자', part: 'kit', set: 'set_heat_work', stat1: 'wil', val1: 32, val1_f: 41, stat2: 'int', val2: 21, val2_f: 27, trait: [{ type: ['오리지늄 아츠 강도'], val: 41, val_f: 53 }] },
  { id: 'gear_30', name: '열 작업용 에너지 저장함', part: 'kit', set: 'set_heat_work', stat1: 'str', val1: 32, val1_f: 41, stat2: 'agi', val2: 21, val2_f: 27, trait: [{ type: ['오리지늄 아츠 강도'], val: 41, val_f: 53 }] },
  { id: 'gear_31', name: '열 작업용 온도 측정기', part: 'kit', set: 'set_heat_work', stat1: 'int', val1: 41, val1_f: 53, stat2: null, val2: 0, trait: [{ type: ['배틀 스킬 피해'], val: '41.4%', val_f: '53.8%' }] },
  { id: 'gear_32', name: '열 작업용 건틀릿 · I', part: 'gloves', set: 'set_heat_work', stat1: 'wil', val1: 65, val1_f: 84, stat2: 'int', val2: 43, val2_f: 55, trait: [{ type: ['열기 피해'], val: '19.2%', val_f: '24.9%' }, { type: ['자연 피해'], val: '19.2%', val_f: '24.9%' }] },
  { id: 'gear_33', name: '열 작업용 건틀릿', part: 'gloves', set: 'set_heat_work', stat1: 'int', val1: 65, val1_f: 84, stat2: 'str', val2: 43, val2_f: 55, trait: [{ type: ['열기 피해'], val: '19.2%', val_f: '24.9%' }, { type: ['자연 피해'], val: '19.2%', val_f: '24.9%' }] },
  { id: 'gear_34', name: '열 작업용 강화 골격', part: 'armor', set: 'set_heat_work', stat1: 'str', val1: 87, val1_f: 113, stat2: 'agi', val2: 58, val2_f: 75, trait: [{ type: ['열기 피해'], val: '11.5%', val_f: '14.9%' }, { type: ['자연 피해'], val: '11.5%', val_f: '14.9%' }] },
  { id: 'gear_35', name: '개척자 증량 산소 공급 장치', part: 'kit', set: 'set_pioneer', stat1: 'agi', val1: 32, val1_f: 41, stat2: 'int', val2: 21, val2_f: 27, trait: [{ type: ['스탯'], stat: '부스탯', val: '20.7%', val_f: '26.9%' }] },
  { id: 'gear_36', name: '개척자 통신기 · I', part: 'kit', set: 'set_pioneer', stat1: 'str', val1: 32, val1_f: 41, stat2: 'int', val2: 21, val2_f: 27, trait: [{ type: ['냉기 피해'], val: '23%', val_f: '29.9%' }, { type: ['전기 피해'], val: '23%', val_f: '29.9%' }] },
  { id: 'gear_37', name: '개척자 통신기', part: 'kit', set: 'set_pioneer', stat1: 'str', val1: 32, val1_f: 41, stat2: 'agi', val2: 21, val2_f: 27, trait: [{ type: ['연계 스킬 피해'], val: '41.4%', val_f: '53.8%' }] },
  { id: 'gear_38', name: '개척자 내부식성 장갑', part: 'gloves', set: 'set_pioneer', stat1: 'agi', val1: 65, val1_f: 84, stat2: 'int', val2: 43, val2_f: 55, trait: [{ type: ['배틀 스킬 피해'], val: '34.5%', val_f: '44.9%' }] },
  { id: 'gear_39', name: '개척자 방어구 · III', part: 'armor', set: 'set_pioneer', stat1: 'agi', val1: 87, val1_f: 113, stat2: 'int', val2: 58, val2_f: 75, trait: [{ type: ['스탯'], stat: '부스탯', val: '10.4%', val_f: '13.5%' }] },
  { id: 'gear_40', name: '개척자 방어구 · II', part: 'armor', set: 'set_pioneer', stat1: 'agi', val1: 87, val1_f: 113, stat2: 'int', val2: 58, val2_f: 75, trait: [{ type: ['배틀 스킬 피해'], val: '20.7%', val_f: '26.9%' }] },
  { id: 'gear_41', name: '개척자 방어구 · I', part: 'armor', set: 'set_pioneer', stat1: 'str', val1: 87, val1_f: 113, stat2: 'agi', val2: 58, val2_f: 75, trait: [{ type: ['배틀 스킬 피해'], val: '20.7%', val_f: '26.9%' }] },
  { id: 'gear_42', name: '개척자 방어구', part: 'armor', set: 'set_pioneer', stat1: 'str', val1: 87, val1_f: 113, stat2: 'int', val2: 58, val2_f: 75, trait: [{ type: ['궁극기 피해'], val: '25.9%', val_f: '33.6%' }] },
  { id: 'gear_43', name: '펄스식 교정기', part: 'kit', set: 'set_pulse', stat1: 'int', val1: 41, val1_f: 53, stat2: null, val2: 0, trait: [{ type: ['오리지늄 아츠 강도'], val: 41, val_f: 53 }] },
  { id: 'gear_44', name: '펄스식 장갑', part: 'gloves', set: 'set_pulse', stat1: 'wil', val1: 65, val1_f: 84, stat2: 'int', val2: 43, val2_f: 55, trait: [{ type: ['냉기 피해'], val: '19.2%', val_f: '24.9%' }, { type: ['전기 피해'], val: '19.2%', val_f: '24.9%' }] },
  { id: 'gear_45', name: '펄스식 방해 슈트', part: 'armor', set: 'set_pulse', stat1: 'int', val1: 87, val1_f: 113, stat2: 'wil', val2: 58, val2_f: 75, trait: [{ type: ['오리지늄 아츠 강도'], val: 20, val_f: 27 }] },
  { id: 'gear_46', name: '본 크러셔 조각상 · I', part: 'kit', set: 'set_bone_crusher', stat1: 'wil', val1: 32, val1_f: 41, stat2: 'int', val2: 21, val2_f: 27, trait: [{ type: ['연계 스킬 피해'], val: '41.4%', val_f: '53.8%' }] },
  { id: 'gear_47', name: '본 크러셔 조각상', part: 'kit', set: 'set_bone_crusher', stat1: 'wil', val1: 32, val1_f: 41, stat2: 'agi', val2: 21, val2_f: 27, trait: [{ type: ['배틀 스킬 피해'], val: '41.4%', val_f: '53.8%' }] },
  { id: 'gear_48', name: '본 크러셔 마스크 · I', part: 'kit', set: 'set_bone_crusher', stat1: 'agi', val1: 32, val1_f: 41, stat2: 'str', val2: 21, val2_f: 27, trait: [{ type: ['치명타 확률'], val: '10.4%', val_f: '13.5%' }] },
  { id: 'gear_49', name: '본 크러셔 마스크', part: 'kit', set: 'set_bone_crusher', stat1: 'agi', val1: 32, val1_f: 41, stat2: 'str', val2: 21, val2_f: 27, trait: [{ type: ['불균형 목표에 주는 피해'], val: '41.4%', val_f: '53.8%' }] },
  { id: 'gear_50', name: '본 크러셔 머플러 · I', part: 'armor', set: 'set_bone_crusher', stat1: 'wil', val1: 87, val1_f: 113, stat2: 'agi', val2: 58, val2_f: 75, trait: [{ type: ['궁극기 충전 효율'], val: '12.3%', val_f: '16%' }] },
  { id: 'gear_51', name: '본 크러셔 머플러', part: 'armor', set: 'set_bone_crusher', stat1: 'wil', val1: 87, val1_f: 113, stat2: 'str', val2: 58, val2_f: 75, trait: [{ type: ['연계 스킬 피해'], val: '20.7%', val_f: '26.9%' }] },
  { id: 'gear_52', name: '본 크러셔 중갑 방어구 · I', part: 'armor', set: 'set_bone_crusher', stat1: 'agi', val1: 87, val1_f: 113, stat2: 'str', val2: 58, val2_f: 75, trait: [{ type: ['연계 스킬 피해'], val: '20.7%', val_f: '26.9%' }] },
  { id: 'gear_53', name: '본 크러셔 중갑 방어구', part: 'armor', set: 'set_bone_crusher', stat1: 'agi', val1: 87, val1_f: 113, stat2: 'int', val2: 58, val2_f: 75, trait: [{ type: ['궁극기 충전 효율'], val: '12.3%', val_f: '16%' }] },
  { id: 'gear_54', name: '경량 초자연 안정판', part: 'kit', set: 'set_light_super', stat1: 'agi', val1: 32, val1_f: 41, stat2: 'str', val2: 21, val2_f: 27, trait: [{ type: ['오리지늄 아츠 강도'], val: 41, val_f: 53 }] },
  { id: 'gear_55', name: '경량 초자연 분석 반지', part: 'kit', set: 'set_light_super', stat1: 'str', val1: 32, val1_f: 41, stat2: 'wil', val2: 21, val2_f: 27, trait: [{ type: ['물리 피해'], val: '23%', val_f: '29.9%' }] },
  { id: 'gear_56', name: '경량 초자연 글러브', part: 'gloves', set: 'set_light_super', stat1: 'agi', val1: 65, val1_f: 84, stat2: 'str', val2: 43, val2_f: 55, trait: [{ type: ['오리지늄 아츠 강도'], val: 34, val_f: 45 }] },
  { id: 'gear_57', name: '경량 초자연 보호판', part: 'armor', set: 'set_light_super', stat1: 'str', val1: 87, val1_f: 113, stat2: 'wil', val2: 58, val2_f: 75, trait: [{ type: ['불균형 목표에 주는 피해'], val: '20.7%', val_f: '26.9%' }] },
  { id: 'gear_58', name: '생체 보조 보호 주사기', part: 'kit', set: 'set_bio_support', stat1: 'wil', val1: 41, val1_f: 53, stat2: null, val2: 0, trait: [{ type: ['치유 효율'], val: '20.7%', val_f: '26.9%' }] },
  { id: 'gear_59', name: '생체 보조 보호판', part: 'kit', set: 'set_bio_support', stat1: 'wil', val1: 32, val1_f: 41, stat2: 'int', val2: 21, val2_f: 27, trait: [{ type: ['스탯'], stat: '주스탯', val: '20.7%', val_f: '26.9%' }] },
  { id: 'gear_60', name: '생체 보조 접속기 · I', part: 'kit', set: 'set_bio_support', stat1: 'str', val1: 32, val1_f: 41, stat2: 'wil', val2: 21, val2_f: 27, trait: [{ type: ['최대 생명력'], val: '41.4%', val_f: '53.8%' }] },
  { id: 'gear_61', name: '생체 보조 접속기', part: 'kit', set: 'set_bio_support', stat1: 'str', val1: 32, val1_f: 41, stat2: 'wil', val2: 21, val2_f: 27, trait: [{ type: ['모든 피해 감소'], val: '17.2%', val_f: '21.2%' }] },
  { id: 'gear_62', name: '생체 보조 건틀릿', part: 'gloves', set: 'set_bio_support', stat1: 'wil', val1: 65, val1_f: 84, stat2: 'str', val2: 43, val2_f: 55, trait: [{ type: ['치유 효율'], val: '17.3%', val_f: '22.3%' }] },
  { id: 'gear_63', name: '생체 보조 견갑', part: 'gloves', set: 'set_bio_support', stat1: 'str', val1: 65, val1_f: 84, stat2: 'wil', val2: 43, val2_f: 55, trait: [{ type: ['궁극기 충전 효율'], val: '20.5%', val_f: '26.7%' }] },
  { id: 'gear_64', name: '생체 보조 흉갑', part: 'armor', set: 'set_bio_support', stat1: 'wil', val1: 87, val1_f: 113, stat2: 'int', val2: 58, val2_f: 75, trait: [{ type: ['치유 효율'], val: '10.4%', val_f: '13.5%' }] },
  { id: 'gear_65', name: '생체 보조 중갑', part: 'armor', set: 'set_bio_support', stat1: 'str', val1: 87, val1_f: 113, stat2: 'wil', val2: 58, val2_f: 75, trait: [{ type: ['치유 효율'], val: '10.4%', val_f: '13.5%' }] },
  { id: 'gear_66', name: '홍산 부싯돌', part: 'kit', set: 'set_swordsman', stat1: 'agi', val1: 32, val1_f: 41, stat2: 'str', val2: 21, val2_f: 27, trait: [{ type: ['물리 피해'], val: '23%', val_f: '29.9%' }] },
  { id: 'gear_67', name: '홍산 전술 건틀릿', part: 'gloves', set: 'set_swordsman', stat1: 'agi', val1: 65, val1_f: 84, stat2: 'str', val2: 43, val2_f: 55, trait: [{ type: ['궁극기 피해'], val: '43.1%', val_f: '56.1%' }] },
  { id: 'gear_68', name: '홍산 전술 장갑', part: 'gloves', set: 'set_swordsman', stat1: 'str', val1: 65, val1_f: 84, stat2: 'wil', val2: 43, val2_f: 55, trait: [{ type: ['물리 피해'], val: '19.2%', val_f: '24.9%' }] },
  { id: 'gear_69', name: '홍산 중장갑', part: 'armor', set: 'set_swordsman', stat1: 'agi', val1: 87, val1_f: 113, stat2: 'str', val2: 58, val2_f: 75, trait: [{ type: ['오리지늄 아츠 강도'], val: 20, val_f: 27 }] },
  { id: 'gear_70', name: '위기 탈출 도장 · I', part: 'kit', set: 'set_crisis', stat1: 'wil', val1: 43, val1_f: 55, stat2: null, val2: 0, trait: [{ type: ['치명타 확률'], val: '10.8%', val_f: '14%' }] },
  { id: 'gear_71', name: '위기 탈출 도장', part: 'kit', set: 'set_crisis', stat1: 'int', val1: 43, val1_f: 55, stat2: null, val2: 0, trait: [{ type: ['궁극기 충전 효율'], val: '25.7%', val_f: '33.4%' }] },
  { id: 'gear_72', name: '위기 탈출 식별 패널 · I', part: 'kit', set: 'set_crisis', stat1: 'agi', val1: 43, val1_f: 55, stat2: null, val2: 0, trait: [{ type: ['연계 스킬 피해'], val: '43.2%', val_f: '56.2%' }] },
  { id: 'gear_73', name: '위기 탈출 식별 패널', part: 'kit', set: 'set_crisis', stat1: 'str', val1: 43, val1_f: 55, stat2: null, val2: 0, trait: [{ type: ['모든 피해 감소'], val: '17.8%', val_f: '21.9%' }] }
];

const DATA_SETS = [
  {
    id: 'set_shikyang',
    name: '식양의 숨결',
    effects: [
      { type: ['스탯'], stat: '최대 생명력', val: '1000' },
      { type: ['주는 피해'], val: '16%', target: '팀_외', nonStack: true, triggers: ['증폭', '비호', '취약', '허약'] }
    ]
  },
  {
    id: 'set_joryu',
    name: '조류의 물결',
    effects: [
      { type: ['모든 스킬 피해'], val: '20%' },
      { type: ['아츠 피해'], val: '35%', triggers: ['아츠 부착'] }
    ]
  },
  {
    id: 'set_eungryong',
    name: '응룡 50식',
    effects: [
      { type: ['공격력 증가'], val: '15%' },
      { type: ['연계 스킬 피해'], val: '60%' } // 20% * 3스택 기준
    ]
  },
  {
    id: 'set_mi_police',
    name: 'M. I. 경찰용',
    effects: [
      { type: ['치명타 확률'], val: '10%' },
      { type: ['공격력 증가'], val: '25%' } // 5% * 5스택 기준
    ]
  },
  {
    id: 'set_heat_work',
    name: '열 작업용',
    effects: [
      { type: ['오리지늄 아츠 강도'], val: 30 },
      {
        type: ['열기 피해'], val: '50%', triggers: ['연소 부여']
      },
      { type: ['자연 피해'], val: '50%', triggers: ['부식 부여'] }
    ]
  },
  {
    id: 'set_pioneer',
    name: '개척',
    effects: [
      { type: ['주는 피해'], val: '16%', target: '팀', nonStack: true, triggers: ['스킬 게이지 회복'] }
    ]
  },
  {
    id: 'set_pulse',
    name: '펄스식',
    effects: [
      { type: ['오리지늄 아츠 강도'], val: 30 },
      {
        type: ['전기 피해'], val: '50%', triggers: ['감전 부여']
      },
      { type: ['냉기 피해'], val: '50%', triggers: ['동결 부여'] }
    ]
  },
  {
    id: 'set_bone_crusher',
    name: '본 크러셔',
    effects: [
      { type: ['공격력 증가'], val: '15%' },
      { type: ['배틀 스킬 피해'], val: '60%' } // 30% * 2스택 기준
    ]
  },
  {
    id: 'set_light_super',
    name: '경량 초자연',
    effects: [
      { type: ['공격력 증가'], val: '8%' },
      { type: ['물리 피해'], val: '48%', triggers: ['방어 불능 부여'] } // 8% * 4스택 기준
    ]
  },
  {
    id: 'set_bio_support',
    name: '생체 보조',
    effects: [
      { type: ['치유 효율'], val: '20%' }
    ]
  },
  {
    id: 'set_swordsman',
    name: '검술사',
    effects: []
  },
  { id: 'set_crisis', name: '위기 탈출', effects: [] }
];
