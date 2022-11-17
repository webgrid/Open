using System;
using System.Collections.Generic;
using System.Linq;
using WorldObjects.Tools;
using WorldObjects.Tools.Extensions;
using WorldObjects.World.Enums;
using WorldObjects.World.Interfaces;
using WorldObjects.World.Living;
using WorldObjects.World.Living.Player;
using WorldObjects.World.MessageNoise;

namespace WorldObjects.World.Map
{
    /// <summary>
    /// World encounter are triggered when objects enters, moves, or leaves a collection of blocks.
    /// </summary>
    public sealed class WorldEncounter : WorldEffectArea, IHeartbeat
    {
        public WorldEncounter(World world, WorldBlock origin, byte radius) : base(world, origin, radius)
        {
            ///Default values
            TriggerChance = new Tuple<byte, DiceNotation>(10, new DiceNotation("4d6"));
            TriggerRetry = DateTime.MinValue;
            Encounters = new();
            Players = new ();
            Leave = new List<Func<IWorldInfo, ResultInfo>>{ (IWorldInfo obj) =>
            {
                if (obj.GameObjectType == GameObjectType.Living && obj is PlayerInfo player)
                {
                    Players.Remove(player);
                }
                return ResultInfo.ReturnWithOk();
            } };

            Enter = new List<Func<IWorldInfo, ResultInfo>>{(IWorldInfo obj) =>
            {
                if (obj.GameObjectType == GameObjectType.Living && obj is PlayerInfo player)
                {
                    Players.Add(player);
                }
                return ResultInfo.ReturnWithOk();
            } };
            Game.Configuration.AddObject(this);
        }

        public WorldEncounterSpawn ActiveEncounter { get; private set; }

        /// <summary>
        /// Min and Max players within encounter area
        /// </summary>
        public Tuple<byte, byte> ConditionMinMaxPlayers { get; set; }

        public List<WorldEncounterSpawn> Encounters { get; }

        public override GameObjectType GameObjectType => GameObjectType.WorldEncounter;

        public HashSet<PlayerInfo> Players { get; }

        /// <summary>
        /// Trigger seconds interval, chance %
        /// </summary>
        public Tuple<byte, DiceNotation> TriggerChance { get; set; }

        public DateTime TriggerRetry { get; set; }

        public WorldEncounterSpawn GetRandomEncounter()
        {
            var total = Encounters.Sum(t => t.Chance);

            var successnumber = Utility.RandomNumber(0, total);
            var counter = 0;
            foreach (var item in Encounters)
            {
                if (successnumber.Between(counter, counter + item.Chance))
                    return item;
                counter += item.Chance;
            }
            return null;
        }

        public void Heartbeat()
        {
            if (ActiveEncounter != null)
            {
                if (Utility.DataBaseNow > ActiveEncounter.InactivityTimeout)
                {
                    if (ActiveEncounter.SpawnedObjects != null)
                        ActiveEncounter.EndEncounter();
                    else if (Utility.DataBaseNow > ActiveEncounter.CooldownExpires)
                        ActiveEncounter = null;
                }
                else if (ActiveEncounter.SpawnedObjects?.Any(t => t.GameObjectType == GameObjectType.Living && ((LivingInfo)t).WeaponHitYou.Count > 0) == true)
                    ActiveEncounter.InactivityTimeout = Utility.DataBaseNow.AddSeconds(ActiveEncounter.DurationSeconds);
            }

            if (ActiveEncounter != null || Players.Count == 0 || TriggerRetry > Utility.DataBaseNow)
                return;

            TriggerRetry = Utility.DataBaseNow.AddSeconds(TriggerChance.Item1);

            if (ConditionMinMaxPlayers != null && !Players.Count.Between(ConditionMinMaxPlayers.Item1, ConditionMinMaxPlayers.Item2))
                return;

            if (TriggerChance.Item2.Roll() > Utility.RandomHundred())
            {
                ActiveEncounter = GetRandomEncounter();
                ActiveEncounter?.Init(this);
            }
        }
    }

    public class WorldEncounterSpawn
    {
        public WorldEncounterSpawn()
        {
            CooldownExpires = DateTime.MinValue;
            CooldownSeconds = 120;
            DurationSeconds = 60;
        }

        public byte Chance { get; set; }

        public ushort CooldownSeconds { get; set; }

        public ushort DurationSeconds { get; set; }

        public Func<List<IWorldInfo>> Encounter { get; set; }

        public List<IWorldInfo> SpawnedObjects { get; private set; }

        public MessageInfo Start { get; set; }

        internal DateTime CooldownExpires { get; set; }

        internal DateTime InactivityTimeout { get; set; }

        public void Init(WorldEncounter encounter)
        {
            SpawnedObjects = Encounter();
            InactivityTimeout = Utility.DataBaseNow.AddSeconds(DurationSeconds);
            foreach (var obj in SpawnedObjects)
            {
                var cell = encounter.EffectedCells.GetRandomAvailable(obj, encounter.World);
                if (cell != null)
                    obj.SetWorld(encounter.World, cell);
            }
        }

        internal void EndEncounter()
        {
            for (int i = 0; i < SpawnedObjects.Count; i++)
            {
                var obj = SpawnedObjects[i];

                if (obj.InventoryOwner == null)
                {
                    if (obj.GameObjectType == GameObjectType.Living && obj is ILiving living)
                    {
                        if (!living.IsMeleeAttack && living.Condition == LivingConditionType.Conscious)
                        {
                            Game.Configuration.RemoveObject(obj);
                            SpawnedObjects.Remove(obj);
                        }
                    }
                    else
                    {
                        Game.Configuration.RemoveObject(obj);
                        SpawnedObjects.Remove(obj);
                    }
                }
            }
            SpawnedObjects = null;
            CooldownExpires = Utility.DataBaseNow.AddSeconds(CooldownSeconds);
        }
    }
}