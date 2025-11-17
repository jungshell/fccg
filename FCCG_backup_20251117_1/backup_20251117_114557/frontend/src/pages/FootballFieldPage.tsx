import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  SimpleGrid,
  Text,
  VStack,
  HStack,
  useToast,
  FormControl,
  FormLabel,
  Input,
  Divider,
  IconButton,
  Select
} from '@chakra-ui/react';
import { DeleteIcon, AddIcon, EditIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons';

// 선수 타입 (포지션 정보 제거)
interface Player {
  id: string;
  name: string;
  team?: 'A' | 'B';
}

// 축구장 위 선수 위치 타입
interface PlayerPosition {
  id: string;
  x: number;
  y: number;
}

interface FootballFieldPageProps {
  memberList?: Player[];
  games?: any[];
}

export default function FootballFieldPage({ memberList: propMemberList, games }: FootballFieldPageProps) {
  const toast = useToast();
  const fieldRef = useRef<HTMLDivElement>(null);

  // 팀 선택 상태 (localStorage에서 우선 로드)
  const [selectedTeam, setSelectedTeam] = useState<'A' | 'B' | null>(() => {
    try {
      const saved = localStorage.getItem('futsalSelectedTeam');
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed === 'A' || parsed === 'B' ? parsed : null;
    } catch {
      return null;
    }
  });
  
  // 선택된 선수들 (localStorage에서 우선 로드)
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('futsalSelectedPlayers');
      const parsed = saved ? JSON.parse(saved) : [];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  });

  // 회원명단 (props에서 받은 실제 회원 데이터 사용)
  const [memberList, setMemberList] = useState<Player[]>(() => {
    // props에서 받은 실제 회원 데이터가 있으면 사용
    if (propMemberList && propMemberList.length > 0) {
      const convertedMembers = propMemberList.map(member => ({
        id: String(member.id), // id를 문자열로 변환
        name: String(member.name) // name도 문자열로 변환
      }));
      console.log('✅ 실제 회원 데이터 사용:', convertedMembers.length, '명');
      return convertedMembers;
    }
    
    // props가 없으면 localStorage에서 로드
    try {
      const saved = localStorage.getItem('futsalMemberList');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('futsalMemberList 로드 실패, 빈 배열 사용');
    }
    return [];
  });

  // 용병 목록 (삭제됨)
  const mercenaryList: Player[] = [];

  // 수기 입력 선수
  const [newPlayerName, setNewPlayerName] = useState<string>('');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editPlayerName, setEditPlayerName] = useState<string>('');
  
  // 용병 관리 상태
  const [editingGuestPlayer, setEditingGuestPlayer] = useState<Player | null>(null);
  const [editGuestPlayerName, setEditGuestPlayerName] = useState<string>('');
  
  // 용병 이름 저장 (localStorage에서 우선 로드)
  const [guestPlayerNames, setGuestPlayerNames] = useState<{[key: string]: string}>(() => {
    try {
      const saved = localStorage.getItem('futsalGuestPlayerNames');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [selectedGameDate, setSelectedGameDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('futsalSelectedGameDate');
      return saved || '';
    } catch {
      return '';
    }
  });

  // 팀별 선수 목록 (localStorage에서 우선 로드)
  const [teamA, setTeamA] = useState<Player[]>(() => {
    try {
      const saved = localStorage.getItem('futsalTeamA');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const [teamB, setTeamB] = useState<Player[]>(() => {
    try {
      const saved = localStorage.getItem('futsalTeamB');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 축구장 위 선수 위치 (localStorage에서 우선 로드)
  const [playerPositions, setPlayerPositions] = useState<PlayerPosition[]>(() => {
    try {
      const saved = localStorage.getItem('futsalPlayerPositions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 드래그 상태
  const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 실시간 데이터 동기화 (상태 변경 시 즉시 localStorage 저장)
  const saveToLocalStorage = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`✅ ${key} 저장 완료:`, data);
    } catch (error) {
      console.error(`❌ ${key} 저장 실패:`, error);
    }
  };

  // 상태 변경 시 즉시 localStorage에 저장
  useEffect(() => {
    saveToLocalStorage('futsalTeamA', teamA);
  }, [teamA]);

  useEffect(() => {
    saveToLocalStorage('futsalTeamB', teamB);
  }, [teamB]);

  useEffect(() => {
    saveToLocalStorage('futsalPlayerPositions', playerPositions);
  }, [playerPositions]);

  useEffect(() => {
    saveToLocalStorage('futsalSelectedTeam', selectedTeam);
  }, [selectedTeam]);

  useEffect(() => {
    saveToLocalStorage('futsalSelectedPlayers', Array.from(selectedPlayers));
  }, [selectedPlayers]);

  useEffect(() => {
    saveToLocalStorage('futsalMemberList', memberList);
  }, [memberList]);

  useEffect(() => {
    saveToLocalStorage('futsalGuestPlayerNames', guestPlayerNames);
  }, [guestPlayerNames]);

  // props에서 받은 실제 회원 데이터가 변경될 때 memberList 업데이트 (용병 이름 수정 사항 보존)
  useEffect(() => {
    if (propMemberList && propMemberList.length > 0) {
      const convertedMembers = propMemberList.map(member => ({
        id: String(member.id), // id를 문자열로 변환
        name: String(member.name) // name도 문자열로 변환
      }));
      
      // 기존 memberList에서 용병 이름 수정 사항 보존
      setMemberList(prev => {
        const newList = [...convertedMembers];
        
        // 기존 용병들의 수정된 이름 보존
        prev.forEach(existingMember => {
          if (existingMember.id.startsWith('guest_')) {
            const existingIndex = newList.findIndex(m => m.id === existingMember.id);
            if (existingIndex >= 0) {
              newList[existingIndex] = existingMember; // 수정된 이름 유지
            } else {
              newList.push(existingMember); // 새로운 용병 추가
            }
          }
        });
        
        console.log('✅ 실제 회원 데이터 업데이트 (용병 이름 보존):', newList.length, '명');
        return newList;
      });
    }
  }, [propMemberList]);

  // 확정된 경기 목록 가져오기
  const getConfirmedGames = () => {
    console.log('🔍 getConfirmedGames 호출됨');
    console.log('games 데이터:', games);
    console.log('games 타입:', typeof games);
    console.log('games 길이:', games?.length);
    
    if (!games || !Array.isArray(games)) {
      console.log('❌ games 데이터가 없거나 배열이 아님');
      return [];
    }
    
    // 첫 번째 경기의 전체 구조 출력
    if (games.length > 0) {
      console.log('📋 첫 번째 경기 전체 구조:', games[0]);
      console.log('📋 첫 번째 경기 키들:', Object.keys(games[0]));
    }
    
    const confirmedGames = games.filter(game => {
      console.log('경기 상태 확인:', game.id, game.status);
      console.log('전체 경기 데이터:', game);
      
      // 모든 가능한 상태 필드 확인
      const possibleStatusFields = [
        'status', 'state', 'confirmed', 'isConfirmed', 'gameStatus', 
        'matchStatus', 'isActive', 'active', 'enabled', 'isEnabled'
      ];
      
      let foundStatus = null;
      for (const field of possibleStatusFields) {
        if (game[field] !== undefined) {
          foundStatus = game[field];
          console.log(`✅ 상태 필드 발견: ${field} = ${foundStatus}`);
          break;
        }
      }
      
      if (!foundStatus) {
        console.log('❌ 상태 필드를 찾을 수 없음. 모든 필드:', Object.keys(game));
        // 상태 필드가 없으면 모든 경기를 확정된 것으로 간주
        return true;
      }
      
      // 다양한 상태값 허용
      const isConfirmed = foundStatus === 'CONFIRMED' || 
                        foundStatus === 'confirmed' || 
                        foundStatus === true || 
                        foundStatus === 'true' ||
                        foundStatus === 'ACTIVE' ||
                        foundStatus === 'active';
      
      console.log('최종 확정 여부:', isConfirmed);
      return isConfirmed;
    });
    
    console.log('✅ 확정된 경기 수:', confirmedGames.length);
    return confirmedGames;
  };

  // 선택한 날짜의 투표 인원 가져오기 - 완전히 새로운 간단한 방식
  const getVotedMembers = (gameDate: string) => {
    console.log('🚀 새로운 방식으로 getVotedMembers 호출됨');
    console.log('gameDate:', gameDate);
    
    if (!games || !gameDate) {
      console.log('❌ games 또는 gameDate가 없음');
      return [];
    }
    
    const game = games.find(g => g.date === gameDate);
    console.log('찾은 경기:', game);
    
    if (!game) {
      console.log('❌ 해당 날짜의 경기를 찾을 수 없음');
      return [];
    }
    
    console.log('🎯 경기 데이터 분석:');
    console.log('- selectedMembers:', game.selectedMembers);
    console.log('- mercenaryCount:', game.mercenaryCount);
    console.log('- propMemberList:', propMemberList);
    console.log('- propMemberList 이름들:', propMemberList?.map(m => m.name));
    
    let votedMembers = [];
    
    // 1. selectedMembers 처리 (문자열로 저장된 JSON 파싱)
    if (game.selectedMembers) {
      console.log('✅ selectedMembers 처리 시작:', game.selectedMembers);
      
      let selectedMembersArray = [];
      try {
        // 문자열인 경우 JSON 파싱
        if (typeof game.selectedMembers === 'string') {
          selectedMembersArray = JSON.parse(game.selectedMembers);
        } else if (Array.isArray(game.selectedMembers)) {
          selectedMembersArray = game.selectedMembers;
        }
        console.log('📋 파싱된 selectedMembers:', selectedMembersArray);
      } catch (error) {
        console.error('❌ selectedMembers 파싱 오류:', error);
        selectedMembersArray = [];
      }
      
      selectedMembersArray.forEach((memberName: string) => {
        console.log('🔍 찾는 회원명:', memberName);
        console.log('🔍 전체 회원 목록:', propMemberList?.map(m => ({ id: m.id, name: m.name })));
        
        // 정확한 매칭을 위해 trim() 사용
        const member = (propMemberList || []).find(m => m.name.trim() === memberName.trim());
        console.log('🔍 찾은 회원:', member);
        
        if (member) {
          votedMembers.push({
            id: String(member.id),
            name: String(member.name)
          });
          console.log('✅ 회원 추가:', memberName, '→ ID:', member.id);
        } else {
          console.log('❌ 회원을 찾을 수 없음:', memberName);
          console.log('전체 회원 목록:', propMemberList?.map(m => m.name));
          console.log('정확한 매칭 시도:', propMemberList?.map(m => ({ 
            name: m.name, 
            trimmed: m.name.trim(), 
            target: memberName.trim(),
            match: m.name.trim() === memberName.trim()
          })));
        }
      });
    }
    
    // 2. 용병 추가
    if (game.mercenaryCount && game.mercenaryCount > 0) {
      console.log('✅ 용병 추가 시작:', game.mercenaryCount, '명');
      
      for (let i = 1; i <= game.mercenaryCount; i++) {
        // guestPlayerNames에서 수정된 이름이 있는지 확인
        const guestId = `guest_${i}`;
        const displayName = guestPlayerNames[guestId] || `용병${i}`;
        
        votedMembers.push({
          id: guestId,
          name: displayName
        });
        console.log('✅ 용병 추가:', displayName);
      }
    }
    
    // 3. 수기 입력된 회원들 추가 (memberNames에서 selectedMembers에 없는 회원들)
    if (game.memberNames) {
      console.log('✅ 수기 입력 회원 처리 시작:', game.memberNames);
      
      let memberNamesArray = [];
      try {
        // 문자열인 경우 JSON 파싱
        if (typeof game.memberNames === 'string') {
          memberNamesArray = JSON.parse(game.memberNames);
        } else if (Array.isArray(game.memberNames)) {
          memberNamesArray = game.memberNames;
        }
        console.log('📋 파싱된 memberNames:', memberNamesArray);
      } catch (error) {
        console.error('❌ memberNames 파싱 오류:', error);
        memberNamesArray = [];
      }
      
      // selectedMembers에 없는 회원들 찾기
      const selectedMembersArray = [];
      try {
        if (typeof game.selectedMembers === 'string') {
          const parsed = JSON.parse(game.selectedMembers);
          selectedMembersArray.push(...parsed);
        } else if (Array.isArray(game.selectedMembers)) {
          selectedMembersArray.push(...game.selectedMembers);
        }
      } catch (error) {
        console.error('❌ selectedMembers 파싱 오류:', error);
      }
      
      memberNamesArray.forEach((memberName: string) => {
        // selectedMembers에 없고, 용병이 아닌 경우만 추가
        if (!selectedMembersArray.includes(memberName) && !memberName.startsWith('용병')) {
          votedMembers.push({
            id: `manual_${memberName}`,
            name: memberName
          });
          console.log('✅ 수기 입력 회원 추가:', memberName);
        }
      });
    }
    
    console.log('🎉 최종 투표 인원:', votedMembers.length, '명');
    console.log('📋 투표 인원 목록:', votedMembers);
    
    return votedMembers;
  };

  // 투표한 인원과 나머지 인원 분리
  const getVotedAndNonVotedMembers = () => {
    if (!selectedGameDate) {
      return {
        votedMembers: [],
        nonVotedMembers: memberList
      };
    }
    
    const votedMembers = getVotedMembers(selectedGameDate);
    console.log('🔍 getVotedAndNonVotedMembers - votedMembers:', votedMembers);
    
    const votedMemberIds = votedMembers.map(member => String(member.id));
    console.log('🔍 getVotedAndNonVotedMembers - votedMemberIds:', votedMemberIds);
    
    // 전체 회원명단에서 나머지 인원 찾기
    const allMembers = propMemberList || [];
    const nonVotedMembers = allMembers.filter(member => 
      !votedMemberIds.includes(String(member.id))
    ).map(member => ({
      id: String(member.id),
      name: String(member.name)
    }));
    
    console.log('🔍 getVotedAndNonVotedMembers - nonVotedMembers:', nonVotedMembers);
    
    // votedMembers는 이미 올바른 형태로 반환되므로 그대로 사용
    const result = {
      votedMembers: votedMembers, // 이미 올바른 형태
      nonVotedMembers: nonVotedMembers.map(member => {
        let displayName = String(member.name);
        
        // 용병 이름 변환
        if (String(member.id).startsWith('guest_')) {
          const guestNumber = String(member.id).replace('guest_', '');
          displayName = `용병${guestNumber}`;
        }
        
        return {
          id: String(member.id),
          name: displayName
        };
      })
    };
    
    console.log('🔍 getVotedAndNonVotedMembers - 최종 결과:', result);
    return result;
  };

  // 날짜 변경 시 회원명단 업데이트 (전체 회원명단 유지)
  useEffect(() => {
    if (propMemberList && propMemberList.length > 0) {
      const convertedMembers = propMemberList.map(member => ({
        id: String(member.id),
        name: String(member.name)
      }));
      setMemberList(convertedMembers);
      console.log('✅ 전체 회원명단 유지:', convertedMembers.length, '명');
    }
  }, [propMemberList]);

  // 페이지 언로드 시 최종 저장 (안전장치)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 모든 상태를 한 번에 저장
      saveToLocalStorage('futsalTeamA', teamA);
      saveToLocalStorage('futsalTeamB', teamB);
      saveToLocalStorage('futsalPlayerPositions', playerPositions);
      saveToLocalStorage('futsalSelectedTeam', selectedTeam);
      saveToLocalStorage('futsalSelectedPlayers', Array.from(selectedPlayers));
      saveToLocalStorage('futsalMemberList', memberList);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [teamA, teamB, playerPositions, selectedTeam, selectedPlayers, memberList]);

  // 모든 선수 목록
  const allPlayers = [...memberList, ...mercenaryList];

  // 팀 배정
  const handleAssignTeam = () => {
    if (!selectedTeam) {
      toast({
        title: '팀을 먼저 선택해주세요',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    if (selectedPlayers.size === 0) {
      toast({
        title: '선수를 선택해주세요',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    const playersToAssign = allPlayers.filter(player => selectedPlayers.has(player.id));
    
    // 중복 배정 방지: 이미 팀에 배정된 선수들 필터링
    const availablePlayers = playersToAssign.filter(player => {
      const isInTeamA = teamA.some(p => p.id === player.id);
      const isInTeamB = teamB.some(p => p.id === player.id);
      return !isInTeamA && !isInTeamB;
    });

    if (availablePlayers.length === 0) {
      toast({
        title: '선택된 선수들이 이미 팀에 배정되어 있습니다',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    // 선택된 팀에 추가
    if (selectedTeam === 'A') {
      setTeamA(prev => {
        const updated = [...prev, ...availablePlayers.map(p => ({ ...p, team: 'A' as const }))];
        console.log('✅ A팀 배정 완료:', availablePlayers.map(p => p.name), '총 인원:', updated.length);
        return updated;
      });
    } else {
      setTeamB(prev => {
        const updated = [...prev, ...availablePlayers.map(p => ({ ...p, team: 'B' as const }))];
        console.log('✅ B팀 배정 완료:', availablePlayers.map(p => p.name), '총 인원:', updated.length);
        return updated;
      });
    }

    // 축구장 위 위치 초기화
    setPlayerPositions(prev => {
      const newPositions = prev.filter(pos => !selectedPlayers.has(pos.id));
      const addedPositions = availablePlayers.map(player => ({
        id: player.id,
        x: selectedTeam === 'A' ? 25 : 75,
        y: 20 + Math.random() * 60
      }));
      const updated = [...newPositions, ...addedPositions];
      console.log('✅ 선수 위치 초기화 완료:', updated.length);
      return updated;
    });

    // 선택 초기화
    setSelectedPlayers(new Set());
    setSelectedTeam(null);
    
    toast({
      title: '팀 배정 완료',
      description: `${availablePlayers.length}명이 ${selectedTeam}팀에 배정되었습니다`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  // 수기 입력 선수 추가
  const handleAddManualPlayer = () => {
    if (!newPlayerName.trim()) {
      toast({
        title: '선수명을 입력해주세요',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    const newPlayer: Player = {
      id: `manual_${Date.now()}`,
      name: newPlayerName.trim()
    };

    // 수기 입력 선수를 memberList에 추가
    setMemberList(prev => {
      const updated = [...prev, newPlayer];
      console.log('✅ 수기 입력 선수 추가:', newPlayer.name, '전체 회원:', updated.length);
      return updated;
    });

    // 팀이 선택된 상태라면 자동으로 해당 팀에 배정
    if (selectedTeam) {
      const playerWithTeam = { ...newPlayer, team: selectedTeam };
      
      if (selectedTeam === 'A') {
        setTeamA(prev => {
          const updated = [...prev, playerWithTeam];
          console.log('✅ A팀 자동 배정:', newPlayer.name, '총 인원:', updated.length);
          return updated;
        });
      } else {
        setTeamB(prev => {
          const updated = [...prev, playerWithTeam];
          console.log('✅ B팀 자동 배정:', newPlayer.name, '총 인원:', updated.length);
          return updated;
        });
      }

      // 축구장 위 위치 초기화
      setPlayerPositions(prev => {
        const newPosition = {
          id: newPlayer.id,
          x: selectedTeam === 'A' ? 25 : 75,
          y: 20 + Math.random() * 60
        };
        const updated = [...prev, newPosition];
        console.log('✅ 선수 위치 초기화:', newPlayer.name, '위치:', newPosition);
        return updated;
      });

      toast({
        title: '수기 입력 선수 추가 및 팀 배정 완료',
        description: `${newPlayer.name}이(가) ${selectedTeam}팀에 자동 배정되었습니다`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } else {
      toast({
        title: '수기 입력 선수가 추가되었습니다',
        description: `${newPlayer.name}이(가) 회원명단에 추가되었습니다`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    }

    setNewPlayerName('');
  };

  // 수기 입력 선수 수정 시작
  const handleStartEdit = (player: Player) => {
    setEditingPlayer(player);
    setEditPlayerName(player.name);
  };

  // 수기 입력 선수 수정 완료
  const handleSaveEdit = () => {
    if (!editingPlayer || !editPlayerName.trim()) {
      toast({
        title: '선수명을 입력해주세요',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    const updatedPlayer = { ...editingPlayer, name: editPlayerName.trim() };

    // memberList에서 수정
    setMemberList(prev => {
      const updated = prev.map(p => p.id === editingPlayer.id ? updatedPlayer : p);
      console.log('✅ 수기 입력 선수 수정:', updatedPlayer.name);
      return updated;
    });

    // 팀에서도 수정 (해당 팀에 있다면)
    if (editingPlayer.team === 'A') {
      setTeamA(prev => {
        const updated = prev.map(p => p.id === editingPlayer.id ? updatedPlayer : p);
        console.log('✅ A팀에서 선수 수정:', updatedPlayer.name);
        return updated;
      });
    } else if (editingPlayer.team === 'B') {
      setTeamB(prev => {
        const updated = prev.map(p => p.id === editingPlayer.id ? updatedPlayer : p);
        console.log('✅ B팀에서 선수 수정:', updatedPlayer.name);
        return updated;
      });
    }

    setEditingPlayer(null);
    setEditPlayerName('');

    toast({
      title: '선수명이 수정되었습니다',
      description: `${updatedPlayer.name}으로 변경되었습니다`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  // 수기 입력 선수 수정 취소
  const handleCancelEdit = () => {
    setEditingPlayer(null);
    setEditPlayerName('');
  };

  // 수기 입력 선수 삭제
  const handleDeleteManualPlayer = (player: Player) => {
    // memberList에서 삭제
    setMemberList(prev => {
      const updated = prev.filter(p => p.id !== player.id);
      console.log('✅ 수기 입력 선수 삭제:', player.name, '남은 인원:', updated.length);
      return updated;
    });

    // 팀에서도 삭제 (해당 팀에 있다면)
    if (player.team === 'A') {
      setTeamA(prev => {
        const updated = prev.filter(p => p.id !== player.id);
        console.log('✅ A팀에서 선수 삭제:', player.name, '남은 인원:', updated.length);
        return updated;
      });
    } else if (player.team === 'B') {
      setTeamB(prev => {
        const updated = prev.filter(p => p.id !== player.id);
        console.log('✅ B팀에서 선수 삭제:', player.name, '남은 인원:', updated.length);
        return updated;
      });
    }

    // 축구장 위 위치도 삭제
    setPlayerPositions(prev => {
      const updated = prev.filter(p => p.id !== player.id);
      console.log('✅ 선수 위치 삭제:', player.name);
      return updated;
    });

    toast({
      title: '선수가 삭제되었습니다',
      description: `${player.name}이(가) 삭제되었습니다`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  // 용병 이름 수정 시작
  const handleStartEditGuestPlayer = (player: Player) => {
    setEditingGuestPlayer(player);
    setEditGuestPlayerName(player.name);
  };

  // 용병 이름 수정 저장
  const handleSaveEditGuestPlayer = () => {
    if (!editingGuestPlayer || !editGuestPlayerName.trim()) return;
    
    const newName = editGuestPlayerName.trim();
    const guestId = editingGuestPlayer.id;
    
    // guestPlayerNames에 저장
    setGuestPlayerNames(prev => ({
      ...prev,
      [guestId]: newName
    }));
    
    // memberList 업데이트
    setMemberList(prev => prev.map(p => p.id === guestId ? { ...p, name: newName } : p));
    
    // 팀에서도 업데이트
    setTeamA(prev => prev.map(p => p.id === guestId ? { ...p, name: newName } : p));
    setTeamB(prev => prev.map(p => p.id === guestId ? { ...p, name: newName } : p));
    
    setEditingGuestPlayer(null);
    setEditGuestPlayerName('');
    
    toast({ title: '용병 이름 수정 완료', description: `${newName}으로 변경되었습니다`, status: 'success' });
  };

  // 용병 이름 수정 취소
  const handleCancelEditGuestPlayer = () => {
    setEditingGuestPlayer(null);
    setEditGuestPlayerName('');
  };

  // 팀 구성 공유 기능
  const shareTeamComposition = (platform: 'kakao' | 'email') => {
    if (teamA.length === 0 && teamB.length === 0) {
      toast({
        title: '공유할 팀 구성이 없습니다',
        description: 'A팀 또는 B팀에 선수를 배정한 후 공유해주세요',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const gameInfo = selectedGameDate ? 
      games?.find(g => g.date === selectedGameDate) : null;
    
    const gameDate = gameInfo ? 
      new Date(gameInfo.date).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      }) : '미정';

    // 경기 정보 추가
    const gameLocation = gameInfo?.location || '미정';
    const totalPlayers = teamA.length + teamB.length;
    
    // 팀 구성 표 형태로 정리
    const maxPlayers = Math.max(teamA.length, teamB.length, 4); // 최소 4명까지 표시
    const teamTable = `팀 구성표
A팀(${teamA.length}명)   | B팀(${teamB.length}명)
${Array.from({ length: maxPlayers }, (_, i) => {
  const playerA = teamA[i] ? `${i + 1}. ${teamA[i].name}` : `${i + 1}.`;
  const playerB = teamB[i] ? `${i + 1}. ${teamB[i].name}` : `${i + 1}.`;
  return `${playerA.padEnd(15)} | ${playerB}`;
}).join('\n')}`;

    const shareContent = `⚽ 풋살 경기 팀 구성 공유

📅 경기 날짜: ${gameDate}
📍 경기 장소: ${gameLocation}
👥 전체 인원: ${totalPlayers}명

${teamTable}

🏆 좋은 경기 되세요!`;

    if (platform === 'kakao') {
      // 카카오톡 공유 (Web Share API 사용)
      if (navigator.share) {
        navigator.share({
          title: '풋살 경기 팀 구성',
          text: shareContent,
          url: 'https://fccg.vercel.app' // 공개 URL로 변경
        }).catch(err => {
          console.error('카카오톡 공유 실패:', err);
          toast({
            title: '카카오톡 공유 실패',
            description: '수동으로 복사하여 공유해주세요',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        });
      } else {
        // Web Share API가 지원되지 않는 경우 클립보드에 복사
        navigator.clipboard.writeText(shareContent).then(() => {
          toast({
            title: '팀 구성이 클립보드에 복사되었습니다',
            description: '카카오톡에 붙여넣기하여 공유해주세요',
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
        });
      }
    } else if (platform === 'email') {
      // 이메일 공유
      const subject = `풋살 경기 팀 구성 - ${gameDate}`;
      const body = shareContent;
      const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoLink);
      
      toast({
        title: '이메일 공유 창이 열렸습니다',
        description: '받는 사람을 입력하고 전송해주세요',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 팀에서 선수 제거
  const handleRemoveFromTeam = (playerId: string, team: 'A' | 'B') => {
    if (team === 'A') {
      setTeamA(prev => prev.filter(p => p.id !== playerId));
    } else {
      setTeamB(prev => prev.filter(p => p.id !== playerId));
    }

    // 축구장 위 위치도 제거
    setPlayerPositions(prev => prev.filter(p => p.id !== playerId));

    toast({
      title: '팀에서 선수가 제거되었습니다',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  // 경기 리셋
  const handleResetGame = () => {
    setTeamA([]);
    setTeamB([]);
    setPlayerPositions([]);
    setSelectedPlayers(new Set());
    setSelectedTeam(null);

    console.log('🔄 경기 리셋 완료 - 팀 배정 초기화');

    toast({
      title: '경기가 리셋되었습니다',
      description: '모든 팀 배정이 초기화되었습니다',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  // 선수 선택 토글 (pill 클릭으로 변경)
  const handlePlayerSelect = (playerId: string) => {
    // 이미 팀에 배정된 선수는 선택할 수 없음
    const isInTeamA = teamA.some(p => p.id === playerId);
    const isInTeamB = teamB.some(p => p.id === playerId);
    
    if (isInTeamA || isInTeamB) {
      toast({
        title: '이미 팀에 배정된 선수입니다',
        description: '팀에서 제거한 후 다시 선택해주세요',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    setSelectedPlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
        console.log('❌ 선수 선택 해제:', playerId);
      } else {
        newSet.add(playerId);
        console.log('✅ 선수 선택:', playerId);
      }
      return newSet;
    });
  };

  // 드래그 시작
  const handleDragStart = (e: React.MouseEvent, playerId: string) => {
    e.preventDefault();
    setDraggedPlayer(playerId);
    
    const rect = fieldRef.current?.getBoundingClientRect();
    if (rect) {
      const position = playerPositions.find(p => p.id === playerId);
      if (position) {
        // 마우스 위치와 선수 위치의 차이를 정확하게 계산
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const playerX = (position.x / 100) * rect.width;
        const playerY = (position.y / 100) * rect.height;
        
        setDragOffset({
          x: mouseX - playerX,
          y: mouseY - playerY
        });
        
        console.log('🎯 드래그 시작:', {
          playerId,
          mousePos: { x: mouseX, y: mouseY },
          playerPos: { x: playerX, y: playerY },
          offset: { x: mouseX - playerX, y: mouseY - playerY }
        });
      }
    }
  };

  // 드래그 중
  const handleDrag = (e: React.MouseEvent) => {
    if (!draggedPlayer || !fieldRef.current) return;

    const rect = fieldRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 드래그 오프셋을 고려한 정확한 위치 계산
    const actualX = mouseX - dragOffset.x;
    const actualY = mouseY - dragOffset.y;
    
    // 퍼센트로 변환
    const xPercent = (actualX / rect.width) * 100;
    const yPercent = (actualY / rect.height) * 100;

    // 경계 내로 제한
    const clampedX = Math.max(5, Math.min(95, xPercent));
    const clampedY = Math.max(5, Math.min(95, yPercent));

    setPlayerPositions(prev => 
      prev.map(pos => 
        pos.id === draggedPlayer 
          ? { ...pos, x: clampedX, y: clampedY }
          : pos
      )
    );
  };

  // 드래그 종료
  const handleDragEnd = () => {
    if (draggedPlayer) {
      console.log('🏁 드래그 종료:', draggedPlayer);
    }
    setDraggedPlayer(null);
  };

  return (
    <Box p={4} bg="gray.50" minH="100vh">
      <VStack spacing={6} align="stretch" maxW="1400px" mx="auto">
        {/* 경기 날짜 선택 및 팀 구성 공유 */}
        <Card variant="outline" borderColor="green.300" shadow="md">
          <CardBody p={4}>
            <VStack spacing={4} align="stretch">
              <Text fontSize="md" fontWeight="bold" color="green.700" textAlign="center">
                📅 경기 날짜 선택 및 팀 구성 공유
              </Text>
              <Divider />
              
              <HStack spacing={4} align="end">
                <FormControl flex="1">
                  <FormLabel fontSize="sm">확정된 경기 날짜</FormLabel>
                  <Select
                    placeholder="경기 날짜를 선택하세요"
                    value={selectedGameDate}
                    onChange={(e) => {
                      console.log('🗓️ 날짜 선택:', e.target.value);
                      setSelectedGameDate(e.target.value);
                      localStorage.setItem('futsalSelectedGameDate', e.target.value);
                    }}
                    size="sm"
                  >
                    {getConfirmedGames().map((game) => (
                      <option key={game.id} value={game.date}>
                        {new Date(game.date).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'long'
                        })}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                
                <VStack spacing={2}>
                  <Text fontSize="xs" color="gray.600">팀 구성 공유</Text>
                  <HStack spacing={2}>
                    <Button
                      colorScheme="yellow"
                      size="sm"
                      onClick={() => shareTeamComposition('kakao')}
                      isDisabled={teamA.length === 0 && teamB.length === 0}
                    >
                      💬 카카오톡
                    </Button>
                    <Button
                      colorScheme="blue"
                      size="sm"
                      onClick={() => shareTeamComposition('email')}
                      isDisabled={teamA.length === 0 && teamB.length === 0}
                    >
                      📧 이메일
                    </Button>
                  </HStack>
                </VStack>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        {/* 팀 선택 및 배정 - 컴팩트하게 */}
        <Card variant="outline" borderColor="blue.300" shadow="md">
          <CardBody p={4}>
            <VStack spacing={4} align="stretch">
              <Text fontSize="lg" fontWeight="bold" color="blue.700" textAlign="center">
                🎯 팀 선택 및 배정
              </Text>
              
              <HStack justify="center" spacing={4}>
                <Button
                  size="md"
                  colorScheme="yellow"
                  variant={selectedTeam === 'A' ? 'solid' : 'outline'}
                  onClick={() => setSelectedTeam('A')}
                  _hover={{ transform: 'translateY(-1px)', shadow: 'md' }}
                  transition="all 0.2s"
                >
                  🟡 A팀
                </Button>
                <Button
                  size="md"
                  colorScheme="red"
                  variant={selectedTeam === 'B' ? 'solid' : 'outline'}
                  onClick={() => setSelectedTeam('B')}
                  _hover={{ transform: 'translateY(-1px)', shadow: 'md' }}
                  transition="all 0.2s"
                >
                  🔴 B팀
                </Button>
              </HStack>

              {selectedTeam && (
                <Box textAlign="center">
                  <Text fontSize="sm" color="gray.600" mb={2}>
                    {selectedTeam === 'A' ? '🟡 A팀' : '🔴 B팀'} 선택됨
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    아래에서 선수들을 선택 후 팀 배정하세요
                  </Text>
                </Box>
              )}

              {selectedTeam && selectedPlayers.size > 0 && (
                <Box textAlign="center">
                  <Button
                    size="md"
                    colorScheme="green"
                    onClick={handleAssignTeam}
                    _hover={{ transform: 'translateY(-1px)', shadow: 'md' }}
                    transition="all 0.2s"
                  >
                    🎯 {selectedTeam === 'A' ? 'A팀' : 'B팀'}에 {selectedPlayers.size}명 배정
                  </Button>
                </Box>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* 팀 배정 시스템 - 컴팩트하게 */}
        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
          {/* 회원명단 */}
          <Card variant="outline" borderColor="blue.300" shadow="md">
            <CardBody p={4}>
              <VStack spacing={4} align="stretch">
                <Text fontSize="md" fontWeight="bold" color="blue.700" textAlign="center">
                  👥 회원명단
                </Text>
                <Divider />
                
                {/* 투표한 인원 섹션 */}
                {selectedGameDate && (() => {
                  const { votedMembers, nonVotedMembers } = getVotedAndNonVotedMembers();
                  console.log('🔍 UI 렌더링 - votedMembers:', votedMembers);
                  console.log('🔍 UI 렌더링 - nonVotedMembers:', nonVotedMembers);
                  
                  return (
                    <>
                      <Text fontSize="sm" fontWeight="bold" color="green.600" textAlign="center">
                        ✅ 투표한 인원 ({votedMembers.length}명)
                      </Text>
                      <SimpleGrid columns={6} spacing={2}>
                        {votedMembers.map((player) => {
                        const isSelected = selectedPlayers.has(player.id);
                        const isInTeamA = teamA.some(p => p.id === player.id);
                        const isInTeamB = teamB.some(p => p.id === player.id);
                        const isGuestPlayer = String(player.id).startsWith('guest_');
                        
                        return (
                          <Box key={player.id}>
                            {editingGuestPlayer?.id === player.id ? (
                              <HStack spacing={1}>
                                <Input
                                  value={editGuestPlayerName}
                                  onChange={(e) => setEditGuestPlayerName(e.target.value)}
                                  size="sm"
                                  fontSize="xs"
                                  h="28px"
                                />
                                <IconButton
                                  icon={<CheckIcon />}
                                  size="sm"
                                  h="28px"
                                  w="28px"
                                  onClick={handleSaveEditGuestPlayer}
                                  colorScheme="green"
                                />
                                <IconButton
                                  icon={<CloseIcon />}
                                  size="sm"
                                  h="28px"
                                  w="28px"
                                  onClick={handleCancelEditGuestPlayer}
                                  colorScheme="red"
                                />
                              </HStack>
                            ) : (
                              <HStack spacing={1}>
                                <Button
                                  w="100%"
                                  h="28px"
                                  borderRadius="full"
                                  variant="outline"
                                  onClick={() => handlePlayerSelect(player.id)}
                                  isDisabled={!selectedTeam || isInTeamA || isInTeamB}
                                  bg={
                                    isInTeamA ? 'yellow.100' : 
                                    isInTeamB ? 'red.100' : 
                                    isSelected ? (selectedTeam === 'A' ? 'yellow.200' : 'red.200') : 'green.100'
                                  }
                                  borderColor={
                                    isInTeamA ? 'yellow.400' : 
                                    isInTeamB ? 'red.400' : 
                                    isSelected ? (selectedTeam === 'A' ? 'yellow.500' : 'red.500') : 'green.400'
                                  }
                                  color={
                                    isInTeamA ? 'yellow.700' : 
                                    isInTeamB ? 'red.700' : 
                                    isSelected ? (selectedTeam === 'A' ? 'yellow.800' : 'red.800') : 'green.700'
                                  }
                                  fontSize="xs"
                                  fontWeight="bold"
                                  _hover={{
                                    bg: isInTeamA ? 'yellow.200' : 
                                        isInTeamB ? 'red.200' : 
                                        isSelected ? (selectedTeam === 'A' ? 'yellow.300' : 'red.300') : 'green.200'
                                  }}
                                >
                                  {player.name}
                                </Button>
                                {isGuestPlayer && (
                                  <Box position="relative">
                                    <IconButton
                                      icon={<EditIcon />}
                                      size="xs"
                                      h="12px"
                                      w="12px"
                                      position="absolute"
                                      top="-12px"
                                      right="-12px"
                                      bg="blue.500"
                                      color="white"
                                      borderRadius="full"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newName = prompt('용병 이름을 입력하세요:', player.name);
                                        if (newName && newName.trim()) {
                                          const trimmedName = newName.trim();
                                          
                                          // guestPlayerNames에 저장
                                          setGuestPlayerNames(prev => ({
                                            ...prev,
                                            [player.id]: trimmedName
                                          }));
                                          
                                          // memberList 업데이트
                                          setMemberList(prev => prev.map(p => 
                                            p.id === player.id ? { ...p, name: trimmedName } : p
                                          ));
                                          // 팀에서도 업데이트
                                          setTeamA(prev => prev.map(p => 
                                            p.id === player.id ? { ...p, name: trimmedName } : p
                                          ));
                                          setTeamB(prev => prev.map(p => 
                                            p.id === player.id ? { ...p, name: trimmedName } : p
                                          ));
                                        }
                                      }}
                                      _hover={{ bg: "blue.600" }}
                                      zIndex={1}
                                    />
                                  </Box>
                                )}
                              </HStack>
                            )}
                          </Box>
                        );
                      })}
                    </SimpleGrid>
                    
                      {/* 나머지 인원 섹션 */}
                      {nonVotedMembers.length > 0 && (
                        <>
                          <Divider />
                          <Text fontSize="sm" fontWeight="bold" color="gray.600" textAlign="center">
                            ⚠️ 투표하지 않은 인원 ({nonVotedMembers.length}명)
                          </Text>
                          <SimpleGrid columns={6} spacing={2}>
                            {nonVotedMembers.map((player) => {
                            const isSelected = selectedPlayers.has(player.id);
                            const isInTeamA = teamA.some(p => p.id === player.id);
                            const isInTeamB = teamB.some(p => p.id === player.id);
                            const isGuestPlayer = String(player.id).startsWith('guest_');
                            
                            return (
                              <Box key={player.id}>
                                {editingGuestPlayer?.id === player.id ? (
                                  <HStack spacing={1}>
                                    <Input
                                      value={editGuestPlayerName}
                                      onChange={(e) => setEditGuestPlayerName(e.target.value)}
                                      size="sm"
                                      fontSize="xs"
                                      h="28px"
                                    />
                                    <IconButton
                                      icon={<CheckIcon />}
                                      size="sm"
                                      h="28px"
                                      w="28px"
                                      onClick={handleSaveEditGuestPlayer}
                                      colorScheme="green"
                                    />
                                    <IconButton
                                      icon={<CloseIcon />}
                                      size="sm"
                                      h="28px"
                                      w="28px"
                                      onClick={handleCancelEditGuestPlayer}
                                      colorScheme="red"
                                    />
                                  </HStack>
                                ) : (
                                  <HStack spacing={1}>
                                    <Button
                                      w="100%"
                                      h="28px"
                                      borderRadius="full"
                                      variant="outline"
                                      onClick={() => handlePlayerSelect(player.id)}
                                      isDisabled={!selectedTeam || isInTeamA || isInTeamB}
                                      bg={
                                        isInTeamA ? 'yellow.100' : 
                                        isInTeamB ? 'red.100' : 
                                        isSelected ? (selectedTeam === 'A' ? 'yellow.200' : 'red.200') : 'gray.100'
                                      }
                                      borderColor={
                                        isInTeamA ? 'yellow.400' : 
                                        isInTeamB ? 'red.400' : 
                                        isSelected ? (selectedTeam === 'A' ? 'yellow.500' : 'red.500') : 'gray.400'
                                      }
                                      color={
                                        isInTeamA ? 'yellow.700' : 
                                        isInTeamB ? 'red.700' : 
                                        isSelected ? (selectedTeam === 'A' ? 'yellow.800' : 'red.800') : 'gray.700'
                                      }
                                      fontSize="xs"
                                      fontWeight="bold"
                                      _hover={{
                                        bg: isInTeamA ? 'yellow.200' : 
                                            isInTeamB ? 'red.200' : 
                                            isSelected ? (selectedTeam === 'A' ? 'yellow.300' : 'red.300') : 'gray.200'
                                      }}
                                    >
                                      {player.name}
                                    </Button>
                                    {isGuestPlayer && (
                                      <Box position="relative">
                                        <IconButton
                                          icon={<EditIcon />}
                                          size="xs"
                                          h="12px"
                                          w="12px"
                                          position="absolute"
                                          top="-12px"
                                          right="-12px"
                                          bg="blue.500"
                                          color="white"
                                          borderRadius="full"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const newName = prompt('용병 이름을 입력하세요:', player.name);
                                            if (newName && newName.trim()) {
                                              const trimmedName = newName.trim();
                                              
                                              // guestPlayerNames에 저장
                                              setGuestPlayerNames(prev => ({
                                                ...prev,
                                                [player.id]: trimmedName
                                              }));
                                              
                                              // memberList 업데이트
                                              setMemberList(prev => prev.map(p => 
                                                p.id === player.id ? { ...p, name: trimmedName } : p
                                              ));
                                              // 팀에서도 업데이트
                                              setTeamA(prev => prev.map(p => 
                                                p.id === player.id ? { ...p, name: trimmedName } : p
                                              ));
                                              setTeamB(prev => prev.map(p => 
                                                p.id === player.id ? { ...p, name: trimmedName } : p
                                              ));
                                            }
                                          }}
                                          _hover={{ bg: "blue.600" }}
                                          zIndex={1}
                                        />
                                      </Box>
                                    )}
                                  </HStack>
                                )}
                              </Box>
                            );
                          })}
                          </SimpleGrid>
                        </>
                      )}
                    </>
                  );
                })()}
                
                {/* 날짜가 선택되지 않은 경우 전체 회원명단 표시 */}
                {!selectedGameDate && (
                  <SimpleGrid columns={6} spacing={2}>
                    {memberList.map((player) => {
                      const isSelected = selectedPlayers.has(player.id);
                      const isInTeamA = teamA.some(p => p.id === player.id);
                      const isInTeamB = teamB.some(p => p.id === player.id);
                      
                      return (
                        <Box key={player.id}>
                          <Button
                            w="100%"
                            h="28px"
                            borderRadius="full"
                            variant="outline"
                            onClick={() => handlePlayerSelect(player.id)}
                            isDisabled={!selectedTeam || isInTeamA || isInTeamB}
                            bg={
                              isInTeamA ? 'yellow.100' : 
                              isInTeamB ? 'red.100' : 
                              isSelected ? (selectedTeam === 'A' ? 'yellow.200' : 'red.200') : 'gray.100'
                            }
                            borderColor={
                              isInTeamA ? 'yellow.400' : 
                              isInTeamB ? 'red.400' : 
                              isSelected ? (selectedTeam === 'A' ? 'yellow.400' : 'red.400') : 'gray.300'
                            }
                            color={
                              isInTeamA ? 'yellow.800' : 
                              isInTeamB ? 'red.800' : 
                              isSelected ? (selectedTeam === 'A' ? 'yellow.800' : 'red.800') : 'gray.700'
                            }
                            _hover={{
                              bg: isInTeamA ? 'yellow.200' : 
                                   isInTeamB ? 'red.200' : 
                                   isSelected ? (selectedTeam === 'A' ? 'yellow.300' : 'red.300') : 'gray.200'
                            }}
                            transition="all 0.2s"
                            fontSize="xs"
                            opacity={isInTeamA || isInTeamB ? 0.6 : 1}
                          >
                            {player.name}
                          </Button>
                        </Box>
                      );
                    })}
                  </SimpleGrid>
                )}
              </VStack>
            </CardBody>
          </Card>

          {/* 용병 + 수기입력 */}
          <Card variant="outline" borderColor="green.300" shadow="md">
            <CardBody p={4}>
              <VStack spacing={4} align="stretch">
                <Text fontSize="md" fontWeight="bold" color="green.700" textAlign="center">
                  ✏️ 수기입력
                </Text>
                <Divider />
                
                {/* 수기 입력 */}
                <VStack spacing={3} align="stretch">
                  <Text fontSize="sm" fontWeight="bold" color="green.700">수기 입력 선수</Text>
                  <FormControl size="sm">
                    <FormLabel fontSize="xs">선수명</FormLabel>
                    <HStack spacing={2}>
                      <Input
                        placeholder="이름"
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        size="sm"
                      />
                      <Button
                        colorScheme="green"
                        size="sm"
                        onClick={handleAddManualPlayer}
                        isDisabled={!newPlayerName.trim()}
                        leftIcon={<AddIcon />}
                      >
                        추가
                      </Button>
                    </HStack>
                  </FormControl>
                  
                  {/* 수기 입력 인원 목록 */}
                  {memberList.filter(player => String(player.id).startsWith('manual_')).length > 0 && (
                    <Box>
                      <Text fontSize="xs" fontWeight="bold" mb={2} color="green.600">
                        수기 입력 인원 목록
                      </Text>
                      <VStack spacing={1} align="stretch">
                        {memberList
                          .filter(player => String(player.id).startsWith('manual_'))
                          .map((player) => (
                            <Box key={player.id}>
                              {editingPlayer?.id === player.id ? (
                                // 수정 모드
                                <HStack spacing={2}>
                                  <Input
                                    value={editPlayerName}
                                    onChange={(e) => setEditPlayerName(e.target.value)}
                                    size="sm"
                                    placeholder="수정할 이름"
                                  />
                                  <Button
                                    colorScheme="blue"
                                    size="sm"
                                    onClick={handleSaveEdit}
                                    isDisabled={!editPlayerName.trim()}
                                  >
                                    저장
                                  </Button>
                                  <Button
                                    colorScheme="gray"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                  >
                                    취소
                                  </Button>
                                </HStack>
                              ) : (
                                // 일반 모드
                                <HStack spacing={2} justify="space-between">
                                  <Text fontSize="sm" color="green.700">
                                    {player.name}
                                    {player.team && (
                                      <Text as="span" fontSize="xs" color="gray.500" ml={2}>
                                        ({player.team}팀)
                                      </Text>
                                    )}
                                  </Text>
                                  <HStack spacing={1}>
                                    <IconButton
                                      aria-label="수정"
                                      icon={<EditIcon />}
                                      size="xs"
                                      colorScheme="blue"
                                      variant="outline"
                                      onClick={() => handleStartEdit(player)}
                                    />
                                    <IconButton
                                      aria-label="삭제"
                                      icon={<DeleteIcon />}
                                      size="xs"
                                      colorScheme="red"
                                      variant="outline"
                                      onClick={() => handleDeleteManualPlayer(player)}
                                    />
                                  </HStack>
                                </HStack>
                              )}
                            </Box>
                          ))}
                      </VStack>
                    </Box>
                  )}
                </VStack>


              </VStack>
            </CardBody>
          </Card>

          {/* 팀 현황 */}
          <Card variant="outline" borderColor="purple.300" shadow="md">
            <CardBody p={4}>
              <VStack spacing={4} align="stretch">
                <Text fontSize="md" fontWeight="bold" color="purple.700" textAlign="center">
                  🏆 팀 현황
                </Text>
                <Divider />
                
                {/* A팀 */}
                <Box>
                  <Text fontSize="sm" fontWeight="bold" mb={2} color="yellow.700">
                    🟡 A팀 ({teamA.length}명)
                  </Text>
                  <SimpleGrid columns={6} spacing={1}>
                    {teamA.length === 0 ? (
                      <Text fontSize="xs" color="gray.500" textAlign="center" py={1} gridColumn="span 6">
                        배정된 선수 없음
                      </Text>
                    ) : (
                      teamA.map((player) => (
                        <Box key={player.id} position="relative">
                          <Button
                            w="100%"
                            h="24px"
                            borderRadius="full"
                            bg="yellow.100"
                            border="1px solid"
                            borderColor="yellow.200"
                            color="yellow.800"
                            fontSize="xs"
                            fontWeight="medium"
                            _hover={{ bg: 'yellow.200' }}
                            transition="all 0.2s"
                          >
                            {player.name}
                          </Button>
                          <IconButton
                            aria-label="팀에서 제거"
                            icon={<DeleteIcon />}
                            size="xs"
                            colorScheme="red"
                            variant="ghost"
                            position="absolute"
                            top="-8px"
                            right="-8px"
                            onClick={() => handleRemoveFromTeam(player.id, 'A')}
                            zIndex={1}
                          />
                        </Box>
                      ))
                    )}
                  </SimpleGrid>
                </Box>

                {/* B팀 */}
                <Box>
                  <Text fontSize="sm" fontWeight="bold" mb={2} color="red.700">
                    🔴 B팀 ({teamB.length}명)
                  </Text>
                  <SimpleGrid columns={6} spacing={1}>
                    {teamB.length === 0 ? (
                      <Text fontSize="xs" color="gray.500" textAlign="center" py={1} gridColumn="span 6">
                        배정된 선수 없음
                      </Text>
                    ) : (
                      teamB.map((player) => (
                        <Box key={player.id} position="relative">
                          <Button
                            w="100%"
                            h="24px"
                            borderRadius="full"
                            bg="red.100"
                            border="1px solid"
                            borderColor="red.200"
                            color="red.800"
                            fontSize="xs"
                            fontWeight="medium"
                            _hover={{ bg: 'red.200' }}
                            transition="all 0.2s"
                          >
                            {player.name}
                          </Button>
                          <IconButton
                            aria-label="팀에서 제거"
                            icon={<DeleteIcon />}
                            size="xs"
                            colorScheme="red"
                            variant="ghost"
                            position="absolute"
                            top="-8px"
                            right="-8px"
                            onClick={() => handleRemoveFromTeam(player.id, 'B')}
                            zIndex={1}
                          />
                        </Box>
                      ))
                    )}
                  </SimpleGrid>
                </Box>

                {/* 경기 리셋 */}
                <Button
                  colorScheme="gray"
                  size="sm"
                  onClick={handleResetGame}
                  isDisabled={teamA.length === 0 && teamB.length === 0}
                >
                  🔄 경기 리셋
                </Button>
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* 포지션 - 가로형 축구장으로 재설계 */}
        <Card variant="outline" borderColor="green.400" shadow="lg">
          <CardBody p={4}>
            <VStack spacing={4} align="stretch">
              <Text fontSize="lg" fontWeight="bold" color="green.700" textAlign="center">
                🏟️ 포지션
              </Text>
              
              {/* 팀별 인원수 표시 */}
              <HStack justify="space-between" px={4}>
                <Text fontSize="md" fontWeight="bold" color="yellow.700">
                  A팀: {teamA.length}명
                </Text>
                <Text fontSize="md" fontWeight="bold" color="red.700">
                  B팀: {teamB.length}명
                </Text>
              </HStack>
              
              {/* 단순한 선만으로 구성된 축구장 디자인 */}
              <Box
                ref={fieldRef}
                position="relative"
                w="100%"
                h="400px"
                bg="white"
                borderRadius="none"
                border="2px solid"
                borderColor="black"
                overflow="hidden"
                onMouseMove={handleDrag}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                cursor={draggedPlayer ? 'grabbing' : 'default'}
              >
                {/* 중앙선 (세로) */}
                <Box
                  position="absolute"
                  top="0"
                  bottom="0"
                  left="50%"
                  w="1px"
                  bg="black"
                  transform="translateX(-50%)"
                />
                
                {/* 중앙 원 */}
                <Box
                  position="absolute"
                  top="50%"
                  left="50%"
                  w="100px"
                  h="100px"
                  border="1px solid"
                  borderColor="black"
                  borderRadius="full"
                  transform="translate(-50%, -50%)"
                />
                
                
                {/* 페널티 에리어 A팀 (왼쪽) */}
                <Box
                  position="absolute"
                  top="20%"
                  left="0"
                  w="15%"
                  h="60%"
                  border="1px solid"
                  borderColor="black"
                />
                
                {/* 페널티 에리어 B팀 (오른쪽) */}
                <Box
                  position="absolute"
                  top="20%"
                  right="0"
                  w="15%"
                  h="60%"
                  border="1px solid"
                  borderColor="black"
                />
                
                {/* 골 에리어 A팀 (왼쪽) */}
                <Box
                  position="absolute"
                  top="35%"
                  left="0"
                  w="5%"
                  h="30%"
                  border="1px solid"
                  borderColor="black"
                />
                
                {/* 골 에리어 B팀 (오른쪽) */}
                <Box
                  position="absolute"
                  top="35%"
                  right="0"
                  w="5%"
                  h="30%"
                  border="1px solid"
                  borderColor="black"
                />
                
                
                
                
                {/* A팀 선수들 (왼쪽, 드래그 가능) */}
                {teamA.map((player) => {
                  const position = playerPositions.find(p => p.id === player.id);
                  if (!position) return null;
                  
                  return (
                    <Box
                      key={`A-${player.id}`}
                      position="absolute"
                      left={`${position.x}%`}
                      top={`${position.y}%`}
                      w="50px"
                      h="50px"
                      bg="yellow.400"
                      borderRadius="full"
                      border="2px solid"
                      borderColor="yellow.600"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      cursor="grab"
                      _hover={{ transform: 'scale(1.1)', shadow: 'xl' }}
                      transition="all 0.3s"
                      boxShadow="0 4px 15px rgba(0,0,0,0.3)"
                      onMouseDown={(e) => handleDragStart(e, player.id)}
                      _active={{ cursor: 'grabbing' }}
                    >
                      <Text fontSize="xs" fontWeight="bold" color="white">
                        {player.name}
                      </Text>
                    </Box>
                  );
                })}
                
                {/* B팀 선수들 (오른쪽, 드래그 가능) */}
                {teamB.map((player) => {
                  const position = playerPositions.find(p => p.id === player.id);
                  if (!position) return null;
                  
                  return (
                    <Box
                      key={`B-${player.id}`}
                      position="absolute"
                      left={`${position.x}%`}
                      top={`${position.y}%`}
                      w="50px"
                      h="50px"
                      bg="red.400"
                      borderRadius="full"
                      border="2px solid"
                      borderColor="red.600"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      cursor="grab"
                      _hover={{ transform: 'scale(1.1)', shadow: 'xl' }}
                      transition="all 0.3s"
                      boxShadow="0 4px 15px rgba(0,0,0,0.3)"
                      onMouseDown={(e) => handleDragStart(e, player.id)}
                      _active={{ cursor: 'grabbing' }}
                    >
                      <Text fontSize="xs" fontWeight="bold" color="white">
                        {player.name}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
}
